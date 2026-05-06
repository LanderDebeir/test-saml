import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { UserService } from '../users/user.service';
import { AdminService } from '../admin/admin.service';
import { readFileSync } from 'fs';
import { IdentityProvider, ServiceProvider } from 'samlify';
import { resolve } from 'path';
import {
  buildFromTemplate,
  extractXmlAttributeFields,
  inflateXml,
} from 'src/utils';
import { UserDAO } from '../users/types/daos';

@Injectable()
export class SamlService {
  private readonly logger = new Logger(SamlService.name);
  private readonly idp = IdentityProvider({
    metadata: readFileSync(
      resolve(process.cwd(), 'config/certificates/metadata_idp.xml'),
    ),
    privateKey: readFileSync(
      resolve(process.cwd(), 'config/certificates/saml-private-key.key'),
    ),
    signingCert: readFileSync(
      resolve(process.cwd(), 'config/certificates/saml-certificate.cer'),
    ),
    nameIDFormat: ['urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress'],
    loginResponseTemplate: {
      context:
        '<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="{ID}" Version="2.0" IssueInstant="{IssueInstant}" Destination="{Destination}" InResponseTo="{InResponseTo}"><saml:Issuer>{Issuer}</saml:Issuer><samlp:Status><samlp:StatusCode Value="{StatusCode}"/></samlp:Status><saml:Assertion xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="{AssertionID}" Version="2.0" IssueInstant="{IssueInstant}"><saml:Issuer>{Issuer}</saml:Issuer><saml:Subject><saml:NameID Format="{NameIDFormat}">{NameID}</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData NotOnOrAfter="{SubjectConfirmationDataNotOnOrAfter}" Recipient="{SubjectRecipient}" InResponseTo="{InResponseTo}"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="{ConditionsNotBefore}" NotOnOrAfter="{ConditionsNotOnOrAfter}"><saml:AudienceRestriction><saml:Audience>{Audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions>{AuthnStatement}{AttributeStatement}</saml:Assertion></samlp:Response>',
      attributes: [
        {
          name: 'nameId',
          nameFormat: 'urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified',
          valueXsiType: 'xs:string',
          valueTag: 'nameId',
        },
        {
          name: 'email',
          nameFormat: 'urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified',
          valueXsiType: 'xs:string',
          valueTag: 'email',
        },
        {
          name: 'displayName',
          nameFormat: 'urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified',
          valueXsiType: 'xs:string',
          valueTag: 'displayName',
        },
      ],
    },
  });
  constructor(
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    private readonly adminService: AdminService,
  ) {}

  prepareLoginView({
    SAMLRequest,
    RelayState,
  }: {
    SAMLRequest: string;
    RelayState?: string;
  }): {
    issuer: string;
    assertionConsumerServiceUrl: string;
    relayState?: string;
  } {
    if (!SAMLRequest) {
      throw new BadRequestException('SAML Request is required');
    }

    const inflatedXml = inflateXml(SAMLRequest);
    const authnRequestFields = extractXmlAttributeFields(inflatedXml, [
      'ID',
      'AssertionConsumerServiceURL',
    ]);

    const requestId = authnRequestFields.id;
    const assertionConsumerServiceUrl =
      authnRequestFields.assertionconsumerserviceurl;
    const issuer = this.extractIssuerFromAuthnRequest(inflatedXml);

    if (!requestId || !assertionConsumerServiceUrl || !issuer) {
      throw new BadRequestException('Invalid SAML AuthnRequest');
    }

    return {
      issuer,
      assertionConsumerServiceUrl,
      relayState: RelayState,
    };
  }

  async getMetadata() {
    return { metadata: this.idp.getMetadata() };
  }

  async login({
    SAMLRequest,
    email,
    password,
  }: {
    SAMLRequest: string;
    email: string;
    password: string;
  }): Promise<{ context: string; acsUrl: string }> {
    if (!SAMLRequest) {
      throw new BadRequestException('SAML Request is required');
    }

    const inflatedXml = inflateXml(SAMLRequest);
    const authnRequestFields = extractXmlAttributeFields(inflatedXml, [
      'ID',
      'AssertionConsumerServiceURL',
    ]);

    const requestId = authnRequestFields.id;
    const assertionConsumerServiceUrl =
      authnRequestFields.assertionconsumerserviceurl;
    const issuer = this.extractIssuerFromAuthnRequest(inflatedXml);

    if (!requestId || !assertionConsumerServiceUrl || !issuer) {
      throw new BadRequestException('Invalid SAML AuthnRequest');
    }

    const user = await this.findUser({
      email,
      password,
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const hasAccess = await this.adminService.userHasAccessToService({
      userId: user.id,
      serviceName: issuer,
    });

    if (!hasAccess) {
      this.logger.warn(
        `SAML login denied: user=${user.email} (id=${user.id}) attempted to access service="${issuer}" but is not assigned to it`,
      );
      throw new UnauthorizedException(
        'You are not assigned to this service provider',
      );
    }

    // Get service ID and user attributes for this service
    const service = await this.adminService.getServiceByName(issuer);
    let userAttributes: Record<string, string> = {};
    if (service) {
      userAttributes = await this.adminService.getUserAttributes(
        user.id,
        service.id,
      );
    }

    const serviceAttributes = service?.attributes ?? [];
    const parsedServiceAttributes = serviceAttributes
      .map((attribute) => {
        const rawValue = userAttributes[attribute.name];
        if (rawValue === undefined || rawValue === null || rawValue === '') {
          return null;
        }

        const type = (attribute.type || 'string').toLowerCase();
        if (type === 'boolean') {
          return {
            name: attribute.name,
            nameFormat:
              'urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified',
            valueXsiType: 'xs:boolean',
            value: ['true', '1', 'yes', 'on'].includes(rawValue.toLowerCase()),
          };
        }

        if (type === 'number') {
          const parsed = Number.parseInt(rawValue, 10);
          return {
            name: attribute.name,
            nameFormat:
              'urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified',
            valueXsiType: 'xs:integer',
            value: Number.isNaN(parsed) ? rawValue : parsed,
          };
        }

        if (type === 'array') {
          const values = rawValue
            .split(/[\n,]/)
            .map((value) => value.trim())
            .filter(Boolean);
          return {
            name: attribute.name,
            nameFormat:
              'urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified',
            valueXsiType: 'xs:string',
            value: values,
          };
        }

        return {
          name: attribute.name,
          nameFormat: 'urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified',
          valueXsiType: 'xs:string',
          value: rawValue,
        };
      })
      .filter((attribute) => attribute !== null);

    const sp = ServiceProvider({
      metadata: this.buildServiceProviderMetadata({
        issuer,
        assertionConsumerServiceUrl,
      }),
      privateKey: readFileSync(
        resolve(process.cwd(), 'config/certificates/saml-private-key.key'),
      ),
      signingCert: readFileSync(
        resolve(process.cwd(), 'config/certificates/saml-certificate.cer'),
      ),
    });

    const { context } = await this.idp.createLoginResponse(
      sp,
      {
        extract: {
          request: {
            id: requestId,
          },
        },
      },
      'post',
      {
        email: user.email,
        nameID: user.email,
        sessionIndex: requestId,
        attributes: {
          nameId: user.email,
          email: user.email,
          displayName: user.displayName,
          //imageUrl: user.imageUrl,
        },
      },
      // customTagReplacement: render our EJS idp template using the user values
      (templateContext: string) => {
        const now = new Date();
        const fiveMinutesLater = new Date(now.getTime() + 5 * 60000);
        const authnStatement = `<saml:AuthnStatement AuthnInstant="${now.toISOString()}" SessionIndex="${requestId}"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement>`;
        const data = {
          ID: `id-${Math.random().toString(36).slice(2, 10)}`,
          AssertionID: `a-${Math.random().toString(36).slice(2, 10)}`,
          Destination: assertionConsumerServiceUrl,
          Audience: issuer,
          EntityID: issuer,
          SubjectRecipient: assertionConsumerServiceUrl,
          Issuer: this.idp
            ? (this.idp as any).entityMeta?.getEntityID
              ? (this.idp as any).entityMeta.getEntityID()
              : issuer
            : issuer,
          IssueInstant: now.toISOString(),
          AssertionConsumerServiceURL: assertionConsumerServiceUrl,
          StatusCode: 'urn:oasis:names:tc:SAML:2.0:status:Success',
          ConditionsNotBefore: now.toISOString(),
          ConditionsNotOnOrAfter: fiveMinutesLater.toISOString(),
          SubjectConfirmationDataNotOnOrAfter: fiveMinutesLater.toISOString(),
          NameIDFormat: Array.isArray(
            (this.idp as any).entitySetting?.nameIDFormat,
          )
            ? (this.idp as any).entitySetting.nameIDFormat[0]
            : (this.idp as any).entitySetting?.nameIDFormat,
          NameID: user.email,
          InResponseTo: requestId,
          AuthnStatement: authnStatement,
          attributes: [
            {
              name: 'email',
              nameFormat:
                'urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified',
              valueXsiType: 'xs:string',
              value: user.email,
            },
            {
              name: 'displayName',
              nameFormat:
                'urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified',
              valueXsiType: 'xs:string',
              value: user.displayName,
            },
            // Dynamic attributes from service configuration, parsed by type
            ...parsedServiceAttributes,
          ],
        } as any;

        return {
          id: data.ID,
          context: buildFromTemplate({
            templatePath: 'src/templates/idp_response.ejs',
            data,
          }),
        };
      },
    );

    this.logger.log(`Generated SAML response for SP issuer ${issuer}`);
    return { context, acsUrl: assertionConsumerServiceUrl };
  }

  async logout({
    SAMLRequest,
    relayState,
  }: {
    SAMLRequest: string;
    relayState?: string;
  }): Promise<{ context: string; acsUrl: string }> {
    if (!SAMLRequest) {
      throw new BadRequestException('SAML Request is required');
    }

    const inflatedXml = inflateXml(SAMLRequest);
    const logoutRequestFields = extractXmlAttributeFields(inflatedXml, [
      'ID',
      'Destination',
    ]);

    const requestId = logoutRequestFields.id;
    const issuer = this.extractIssuerFromAuthnRequest(inflatedXml);
    const singleLogoutServiceUrl = logoutRequestFields.destination;

    if (!requestId || !singleLogoutServiceUrl || !issuer) {
      throw new BadRequestException('Invalid SAML LogoutRequest');
    }

    const sp = ServiceProvider({
      metadata: this.buildServiceProviderMetadata({
        issuer,
        assertionConsumerServiceUrl: issuer,
        singleLogoutServiceUrl,
      }),
      privateKey: readFileSync(
        resolve(process.cwd(), 'config/certificates/saml-private-key.key'),
      ),
      signingCert: readFileSync(
        resolve(process.cwd(), 'config/certificates/saml-certificate.cer'),
      ),
    });

    const { context } = await this.idp.createLogoutResponse(
      sp,
      {
        extract: {
          request: {
            id: requestId,
          },
        },
      },
      'post',
      relayState,
    );

    this.logger.log(`Generated SAML logout response for SP issuer ${issuer}`);
    return { context, acsUrl: issuer };
  }

  private extractIssuerFromAuthnRequest(
    authnRequestXml: string,
  ): string | null {
    const issuerMatch = authnRequestXml.match(
      /<[^>]*:?Issuer[^>]*>([^<]+)<\/[^>]*:?Issuer>/,
    );
    return issuerMatch?.[1] ?? null;
  }

  private buildServiceProviderMetadata({
    issuer,
    assertionConsumerServiceUrl,
    singleLogoutServiceUrl,
  }: {
    issuer: string;
    assertionConsumerServiceUrl: string;
    singleLogoutServiceUrl?: string;
  }): string {
    return buildFromTemplate({
      templatePath: 'src/templates/sp_metadata.ejs',
      data: {
        issuer,
        assertionConsumerServiceUrl,
        singleLogoutServiceUrl,
      },
    });
  }

  private async findUser({
    email,
    password,
  }: {
    email: string;
    password: string;
  }): Promise<UserDAO> {
    const user = await this.userService.getByEmail({ email, password });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }
}
