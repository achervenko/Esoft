import { StorageModule } from '../storage/storage.module';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  controllers: [HealthController],
  imports: [StorageModule, PrismaModule],
  providers: [HealthService],
})
export class HealthModule {}
