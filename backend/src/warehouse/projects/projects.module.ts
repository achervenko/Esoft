import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { WarehouseProjectsController } from './projects.controller';
import { WarehouseProjectsService } from './projects.service';
@Module({
  imports: [PrismaModule],
  controllers: [WarehouseProjectsController],
  providers: [WarehouseProjectsService],
})
export class WarehouseProjectsModule {}
