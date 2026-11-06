import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../../integrations/integrations.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { WarehouseReceiptsModule } from '../receipts/receipts.module';
import { WarehouseReceiptIntegrationHandler } from './receipt-integration.handler';
import { ReceiptIntegrationWarehousesController } from './receipt-integration-warehouses.controller';
@Module({
  imports: [IntegrationsModule, PrismaModule, WarehouseReceiptsModule],
  controllers: [ReceiptIntegrationWarehousesController],
  providers: [WarehouseReceiptIntegrationHandler],
})
export class WarehouseReceiptIntegrationModule {}
