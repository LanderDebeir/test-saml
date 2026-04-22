import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SamlModule } from '../saml/saml.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
     SamlModule
    ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
