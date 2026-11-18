import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../../integrations/integrations.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { WarehouseReceiptsModule } from '../receipts/receipts.module';
import { WarehouseReceiptIntegrationHandler } from './receipt-integration.handler';
import { ReceiptIntegrationWarehousesController } from './receipt-integration-warehouses.controller';
import { OneCInvoiceDocumentImport } from './one-c-invoice-document-import';
import { OneCInvoicePeriodImportService } from './one-c-invoice-period-import.service';
import { OneCInvoiceScheduler } from './one-c-invoice-scheduler';
import { OneCInvoiceSchedulerService } from './one-c-invoice-scheduler.service';
@Module({
  imports: [IntegrationsModule, PrismaModule, WarehouseReceiptsModule],
  controllers: [ReceiptIntegrationWarehousesController],
  providers: [
    WarehouseReceiptIntegrationHandler,
    OneCInvoiceDocumentImport,
    OneCInvoicePeriodImportService,
    OneCInvoiceScheduler,
    OneCInvoiceSchedulerService,
  ],
  exports: [OneCInvoicePeriodImportService],
})
export class WarehouseReceiptIntegrationModule {}
