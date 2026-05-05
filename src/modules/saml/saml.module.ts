import { forwardRef, Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { UserModule } from '../users/user.module';
import { SamlService } from './saml.service';
import { SamlController } from './saml.controller';

@Module({
  imports: [forwardRef(() => UserModule), AdminModule],
  providers: [SamlService],
  controllers: [SamlController],
  exports: [SamlService],
})
export class SamlModule {}
