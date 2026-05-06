import { Injectable, Logger } from '@nestjs/common';
import { prisma } from 'prisma/prisma';
import { users } from './data/users';

@Injectable()
export class Seeder {
  constructor(private readonly logger: Logger) {}

  async seed() {
    this.logger.debug('Seeding database...');
    await this.seedUsers();
    this.logger.debug('Database seeding completed.');
  }

  private async seedUsers() {
    this.logger.debug('Seeding users...');
    const data = users;
    await prisma.user.createMany({
      data,
      skipDuplicates: true,
    });
    this.logger.debug('Users seeding completed.');
  }
}
