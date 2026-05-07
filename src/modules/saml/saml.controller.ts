import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { SamlService } from './saml.service';
import { buildFromTemplate } from 'src/utils';

@Controller({ version: '1' })
export class SamlController {
  constructor(private readonly samlService: SamlService) {}

  @Get('metadata')
  getMetadata(@Res({ passthrough: true }) response: Response) {
    response.type('application/json');
    return this.samlService.getMetadata();
  }
  @Get('login')
  async loginPage(
    @Query()
    query: {
      SAMLRequest: string;
      RelayState: string;
    },
    @Res({ passthrough: true }) response: Response,
  ) {
    const viewModel = this.samlService.prepareLoginView({
      SAMLRequest: query.SAMLRequest,
      RelayState: query.RelayState,
    });
    response.type('text/html');
    return this.renderLoginView({
      SAMLRequest: query.SAMLRequest,
      RelayState: viewModel.relayState,
      issuer: viewModel.issuer,
      assertionConsumerServiceUrl: viewModel.assertionConsumerServiceUrl,
    });
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body()
    body: {
      SAMLRequest: string;
      RelayState?: string;
    },
    @Res({ passthrough: true }) response: Response,
  ) {
    const viewModel = this.samlService.prepareLoginView(body);
    response.type('text/html');
    return this.renderLoginView({
      SAMLRequest: body.SAMLRequest,
      RelayState: viewModel.relayState,
      issuer: viewModel.issuer,
      assertionConsumerServiceUrl: viewModel.assertionConsumerServiceUrl,
    });
  }

  @Get('logout')
  async logoutPage(
    @Query('SAMLRequest') samlRequest: string,
    @Query('RelayState') relayState?: string,
    @Res({ passthrough: true }) response?: Response,
  ) {
    response?.type('text/html');

    const { context, acsUrl } = await this.samlService.logout({
      SAMLRequest: samlRequest,
    });
    return this.wrapInAutoSubmitForm(context, acsUrl, relayState);
  }

  @Post('login/submit')
  @HttpCode(200)
  async submitLogin(
    @Body()
    body: {
      SAMLRequest: string;
      RelayState?: string;
      email: string;
      password: string;
    },
    @Res({ passthrough: true }) response: Response,
  ) {
    const { context, acsUrl } = await this.samlService.login(body);
    response.type('text/html');
    return this.wrapInAutoSubmitForm(context, acsUrl, body.RelayState);
  }

  @Post('logout')
  @HttpCode(200)
  async logout(
    @Body()
    body: {
      SAMLRequest: string;
      RelayState?: string;
    },
    @Res({ passthrough: true }) response: Response,
  ) {
    response.type('text/html');

    const { context, acsUrl } = await this.samlService.logout({
      SAMLRequest: body.SAMLRequest,
    });
    return this.wrapInAutoSubmitForm(context, acsUrl, body.RelayState);
  }

  @Get('slo')
  async sloGet(
    @Query('SAMLResponse') samlResponse?: string,
    @Query('RelayState') relayState?: string,
    @Res({ passthrough: true }) response?: Response,
  ) {
    response?.type('text/html');
    return '<!doctype html><html><body><h1>Logout successful</h1></body></html>';
  }

  @Post('slo')
  @HttpCode(200)
  async sloPost(
    @Body('SAMLResponse') samlResponse?: string,
    @Body('RelayState') relayState?: string,
    @Res({ passthrough: true }) response?: Response,
  ) {
    response?.type('text/html');
    return '<!doctype html><html><body><h1>Logout successful</h1></body></html>';
  }

  private renderLoginView(data: {
    SAMLRequest: string;
    RelayState?: string;
    issuer: string;
    assertionConsumerServiceUrl: string;
  }): string {
    return buildFromTemplate({
      templatePath: 'src/templates/admin/login.ejs',
      data: {
        ...data,
        title: 'Sign in to continue',
        heading: 'Sign in to continue',
        formAction: '/login/submit',
        buttonLabel: 'Go to site',
        samlMode: true,
      },
    });
  }

  private wrapInAutoSubmitForm(
    samlResponse: string,
    acsUrl: string,
    relayState?: string,
  ): string {
    return buildFromTemplate({
      templatePath: 'src/templates/auto_submit_form.ejs',
      data: { samlResponse, acsUrl, relayState },
    });
  }
}
