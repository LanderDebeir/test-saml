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
  extractXmlAttributeFields,
  inflateXml,
} from 'src/utils';

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
    email,
    password,
  }: {
    samlRequest: string;
    relayState?: string;
    email: string;
    password: string;
  }): Promise<string> {
    if (!samlRequest || !email || !password) {
      throw new BadRequestException(
        'samlRequest, email and password are required',
      );
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

    if (!requestId || !assertionConsumerServiceUrl || !issuer) {
      throw new BadRequestException('Invalid SAML AuthnRequest');
    }

    const user = await this.findOrCreateUser({ email, password });
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
  }: {
    issuer: string;
    assertionConsumerServiceUrl: string;
  }): string {
    return buildXmlFromTemplate({
      templatePath: '../../templates/sp_metadata.ejs',
      data: { issuer, assertionConsumerServiceUrl },
    });
  }

  private async findOrCreateUser({
    email,
    password,
  }: {
    email: string;
    password: string;
  }): Promise<{ email: string }> {
    let user = await this.userService.getByEmail({ email, password });

    if (!user) {
      user = await this.userService.createUser({ email, password });
    }
    return { email: user?.email };
  }
}
