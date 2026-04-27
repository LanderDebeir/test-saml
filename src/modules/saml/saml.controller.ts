import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { SamlService } from './saml.service';

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
      samlRequest: string;
      relayState?: string;
    },
    @Res({ passthrough: true }) response: Response,
  ) {
    const context = await this.samlService.login(body);
    response.type('text/html');
    return context;
  }

  @Post('logout')
  @HttpCode(200)
  async logout(
    @Body()
    body: {
      samlRequest: string;
      relayState?: string;
    },
    @Res({ passthrough: true }) response: Response,
  ) {
    const context = await this.samlService.logout(body);
    response.type('text/html');
    return context;
  }
}
