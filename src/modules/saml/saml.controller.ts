import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
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

  @Post('login')
  @HttpCode(200)
  async login(
    @Body()
    body: {
      SAMLRequest: string;
    },
    @Res({ passthrough: true }) response: Response,
  ) {
    const { context, acsUrl } = await this.samlService.login(body);
    response.type('text/html');
    return this.wrapInAutoSubmitForm(context, acsUrl);
  }

  @Post('logout')
  @HttpCode(200)
  async logout(
    @Body()
    body: {
      SAMLRequest: string;
    },
    @Res({ passthrough: true }) response: Response,
  ) {
    const { context, acsUrl } = await this.samlService.logout(body);
    response.type('text/html');
    return this.wrapInAutoSubmitForm(context, acsUrl);
  }

  private wrapInAutoSubmitForm(samlResponse: string, acsUrl: string): string {
    return buildFromTemplate({
      templatePath: 'src/templates/auto_submit_form.ejs',
      data: { samlResponse, acsUrl },
    });
  }
}
