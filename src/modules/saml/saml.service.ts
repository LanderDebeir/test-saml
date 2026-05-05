import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { UserService } from '../users/user.service';
import { readFileSync } from 'fs';
import { IdentityProvider, ServiceProvider } from 'samlify';
import { resolve } from 'path';
import {
  buildFromTemplate,
  extractSamlAttributeFields,
  extractXmlAttributeFields,
  inflateXml,
} from 'src/utils';
import { UserDAO } from '../users/types/daos';
import { env } from 'process';

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
        {
          name: 'imageUrl',
          nameFormat: 'urn:oasis:names:tc:SAML:2.0:attrname-format:unspecified',
          valueXsiType: 'xs:string',
          valueTag: 'imageUrl',
        },
      ],
    },
  });
  constructor(
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
  ) {}

  async getMetadata() {
    return { metadata: this.idp.getMetadata() };
  }

  async login({
    SAMLRequest,
  }: {
    SAMLRequest: string;
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
    const samlCredentialFields = extractSamlAttributeFields(inflatedXml, [
      'email',
      'password',
    ]);

    if (!requestId || !assertionConsumerServiceUrl || !issuer) {
      throw new BadRequestException('Invalid SAML AuthnRequest');
    }

    const resolvedEmail = samlCredentialFields.email;
    const resolvedPassword = samlCredentialFields.password;

    // if (!resolvedEmail || !resolvedPassword) {
    //   throw new BadRequestException(
    //     'email and password must be provided as SAML attributes',
    //   );
    // }

    const user = await this.findUser({
      email: resolvedEmail || env.TEST_USER_EMAIL,
      password: resolvedPassword || env.TEST_USER_PASSWORD,
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const sp = ServiceProvider({
      metadata: this.buildServiceProviderMetadata({
        issuer,
        assertionConsumerServiceUrl,
      }),
      privateKey: readFileSync(resolve(process.cwd(), 'config/certificates/saml-private-key.key')),
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
          imageUrl: user.imageUrl,
        },
      },
    );

    this.logger.log(`Generated SAML response for SP issuer ${issuer}`);
    return { context, acsUrl: assertionConsumerServiceUrl };
  }

  async logout({
    SAMLRequest,
  }: {
    SAMLRequest: string;
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
    const singleLogoutServiceUrl = logoutRequestFields.destination;
    const issuer = this.extractIssuerFromAuthnRequest(inflatedXml);

    if (!requestId || !singleLogoutServiceUrl || !issuer) {
      throw new BadRequestException('Invalid SAML LogoutRequest');
    }

    const sp = ServiceProvider({
      metadata: this.buildServiceProviderMetadata({
        issuer,
        assertionConsumerServiceUrl: singleLogoutServiceUrl,
        singleLogoutServiceUrl,
      }),
      privateKey: readFileSync(resolve(process.cwd(), 'config/certificates/saml-private-key.key')),
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
    );

    this.logger.log(`Generated SAML logout response for SP issuer ${issuer}`);
    return { context, acsUrl: singleLogoutServiceUrl };
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
