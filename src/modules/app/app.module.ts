import { Module } from '@nestjs/common';
import { SamlModule } from '../saml/saml.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [SamlModule, AdminModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
