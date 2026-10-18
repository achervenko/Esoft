import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WarehouseCatalogController } from './catalog/catalog.controller';
import { WarehouseCatalogService } from './catalog/catalog.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [WarehouseCatalogController],
  providers: [WarehouseCatalogService],
})
export class WarehouseModule {}
