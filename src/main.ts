import { NestFactory } from '@nestjs/core';
import { AppModule } from './Infrastructure/Api/modules/mod';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
