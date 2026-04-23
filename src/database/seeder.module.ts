import { Logger, Module } from '@nestjs/common';
import { Seeder } from './seeder';

@Module({
  imports: [],
  providers: [Logger, Seeder],
})
export class SeederModule {}
