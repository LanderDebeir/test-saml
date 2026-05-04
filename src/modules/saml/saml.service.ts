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
  });
  constructor(
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
  ) {}

  async getMetadata() {
    return this.idp.getMetadata();
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
