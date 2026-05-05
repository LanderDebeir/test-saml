import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './modules/app/app.module';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule as any);

  // Use project root templates directory so views are available during dev/watch
  app.setBaseViewsDir(path.join(process.cwd(), 'templates'));
  app.setViewEngine('ejs');

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();

