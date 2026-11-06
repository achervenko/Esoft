import { WarehouseCatalogUsagePolicy } from './catalog-usage.policy';
import { WarehouseCatalogExternalLinksService } from './catalog-external-links.service';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../audit/audit.module';
import { WarehouseCatalogController } from './catalog.controller';
import { WarehouseCatalogService } from './catalog.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [WarehouseCatalogController],
  providers: [
    WarehouseCatalogService,
    WarehouseCatalogExternalLinksService,
    WarehouseCatalogUsagePolicy,
  ],
  exports: [
    WarehouseCatalogService,
    WarehouseCatalogExternalLinksService,
    WarehouseCatalogUsagePolicy,
  ],
})
export class WarehouseCatalogModule {}
