import { Module } from '@nestjs/common';
import { SamlModule } from '../saml/saml.module';

@Module({
  imports: [
     SamlModule
    ],
  controllers: [],
  providers: [],
})
export class AppModule {}
