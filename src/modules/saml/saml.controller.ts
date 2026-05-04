import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { SamlService } from './saml.service';
import { wrapInAutoSubmitForm } from 'src/utils';

@Controller({ version: '1' })
export class SamlController {
  constructor(private readonly samlService: SamlService) {}

  @Get('metadata')
  getMetadata() {
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
    const { context, acsUrl } = await this.samlService.login({
      samlRequest: body.SAMLRequest,
    });
    response.type('text/html');
    return wrapInAutoSubmitForm(context, acsUrl);
  }

  @Post('logout')
  @HttpCode(200)
  async logout(
    @Body()
    body: {
      samlRequest: string;
    },
    @Res({ passthrough: true }) response: Response,
  ) {
    const { context, acsUrl } = await this.samlService.logout(body);
    response.type('text/html');
    return wrapInAutoSubmitForm(context, acsUrl);
  }
}
