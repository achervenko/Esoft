import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { WarehouseCatalogUsagePolicy } from '../catalog/catalog-usage.policy';
@Injectable()
export class ReceiptCatalogUsagePolicy
  implements OnModuleInit, OnModuleDestroy
{
  private unregister?: () => void;
  constructor(private readonly catalogUsage: WarehouseCatalogUsagePolicy) {}
  onModuleInit() {
    this.unregister = this.catalogUsage.register(
      'warehouse.receipts',
      async (tx, itemId) =>
        !!(await tx.warehouseReceiptLine.findFirst({
          where: {
            itemId,
            receipt: { status: { in: ['RECEIVED', 'PLACING'] } },
          },
          select: { id: true },
        })),
    );
  }
  onModuleDestroy() {
    this.unregister?.();
  }
}
