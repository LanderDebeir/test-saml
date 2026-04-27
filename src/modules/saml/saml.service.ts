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
import {
  buildXmlFromTemplate,
  extractSamlAttributeFields,
  extractXmlAttributeFields,
  inflateXml,
} from 'src/utils';
import { UserDAO } from '../users/types/daos';

@Injectable()
export class SamlService {
  private readonly logger = new Logger(SamlService.name);
  private readonly idp = IdentityProvider({
    metadata: readFileSync('config/certificates/metadata_idp.xml'),
  });
  constructor(
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
  ) {}

  async getMetadata() {
    return this.idp.getMetadata();
  }

  async login({
    samlRequest,
    relayState,
  }: {
    samlRequest: string;
    relayState?: string;
  }): Promise<string> {
    if (!samlRequest) {
      throw new BadRequestException('samlRequest is required');
    }

    const inflatedXml = inflateXml(samlRequest);
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

    if (!resolvedEmail || !resolvedPassword) {
      throw new BadRequestException(
        'email and password must be provided as SAML attributes',
      );
    }

    const user = await this.findUser({
      email: resolvedEmail,
      password: resolvedPassword,
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
        },
      },
      undefined,
      undefined,
      relayState,
    );

    this.logger.log(`Generated SAML response for SP issuer ${issuer}`);
    return context;
  }

  async logout({
    samlRequest,
    relayState,
  }: {
    samlRequest: string;
    relayState?: string;
  }): Promise<string> {
    if (!samlRequest) {
      throw new BadRequestException('samlRequest is required');
    }

    const inflatedXml = inflateXml(samlRequest);
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
      relayState,
    );

    this.logger.log(`Generated SAML logout response for SP issuer ${issuer}`);
    return context;
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
    return buildXmlFromTemplate({
      templatePath: '../../templates/sp_metadata.ejs',
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
    let user = await this.userService.getByEmail({ email, password });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }
}
