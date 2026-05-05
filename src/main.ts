import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './modules/app/app.module';
import * as express from 'express';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Use project root templates directory so views are available during dev/watch
  app.setBaseViewsDir(path.join(process.cwd(), 'templates'));
  app.setViewEngine('ejs');
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();

