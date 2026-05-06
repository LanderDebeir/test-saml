import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { Seeder } from './database/seeder/seeder';
import { SeederModule } from './database/seeder/seeder.module';

async function bootstrap() {
  NestFactory.createApplicationContext(SeederModule)
    .then((appContext) => {
      const logger = appContext.get(Logger);
      const seeder = appContext.get(Seeder);

      seeder
        .seed()
        .then(() => {
          logger.debug('Seeding completed successfully');
        })
        .catch((error) => {
          logger.error('Error during seeding', error);
        })
        .finally(() => {
          appContext.close();
        });
    })
    .catch((error) => {
      throw error;
    });
}

bootstrap();
