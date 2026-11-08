import { StorageModule } from '../storage/storage.module';
import { WarehouseTransfersController } from './transfers/transfers.controller';
jest.mock('@thallesp/nestjs-better-auth', () => ({
  AllowAnonymous: () =>
    jest
      .requireActual<typeof import('@nestjs/common')>('@nestjs/common')
      .SetMetadata('PUBLIC', true),
  Session: jest
    .requireActual<typeof import('@nestjs/common')>('@nestjs/common')
    .createParamDecorator(() => undefined),
}));
import { Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { StorageFileService } from '../storage/storage-file.service';
import { StorageStagedUploadService } from '../storage/storage-staged-upload.service';
import { WarehouseModule } from './warehouse.module';
import { MachineApiKeysService } from '../auth/machine-api-keys.service';
import { WarehouseStockModule } from './stock/stock.module';
import { WarehouseStockService } from './stock/stock.service';
import { WarehouseStockQueryService } from './stock/stock-query.service';
import { WarehouseReceiptsService } from './receipts/receipts.service';
import { WarehouseReceiptItemMappingService } from './receipts/receipt-item-mapping.service';
import { WarehouseReceiptReconciliationService } from './receipts/receipt-reconciliation.service';
import { WarehouseReceiptConflictResolutionService } from './receipts/receipt-conflict-resolution.service';
import { WarehouseIssueSheetsService } from './issue-sheets/issue-sheets.service';
import { WarehouseIssuesController } from './issues/issues.controller';
import { WarehouseStockAdjustmentsController } from './adjustments/adjustments.controller';
import { WarehouseCatalogController } from './catalog/catalog.controller';
import { WarehousesController } from './storage-structure/warehouses.controller';
import { WarehouseStorageLocationsController } from './storage-structure/storage-locations.controller';
import { WarehouseStockController } from './stock/stock.controller';
import { WarehouseReceiptsController } from './receipts/receipts.controller';
import { WarehouseIssueSheetsController } from './issue-sheets/issue-sheets.controller';

@Module({
  providers: [
    { provide: StorageFileService, useValue: {} },
    { provide: StorageStagedUploadService, useValue: {} },
  ],
  exports: [StorageFileService, StorageStagedUploadService],
})
class StorageFixtureModule {}

@Injectable()
class WarehouseClient {
  constructor(
    readonly stock: WarehouseStockService,
    readonly sheets: WarehouseIssueSheetsService,
    readonly receipts: WarehouseReceiptsService,
  ) {}
}
@Module({
  imports: [WarehouseModule],
  providers: [WarehouseClient],
  exports: [WarehouseClient],
})
class WarehouseClientModule {}

@Injectable()
class PrivateQueryClient {
  constructor(readonly queries: WarehouseStockQueryService) {}
}

describe('Warehouse component wiring', () => {
  it('resolves real components and preserves the public API through the root module', async () => {
    const fixture = await Test.createTestingModule({
      imports: [WarehouseClientModule],
    })
      .overrideModule(StorageModule)
      .useModule(StorageFixtureModule)
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(MachineApiKeysService)
      .useValue({})
      .compile();
    try {
      const client = fixture.get(WarehouseClient);
      expect(client.stock).toBe(
        fixture
          .select(WarehouseStockModule)
          .get(WarehouseStockService, { strict: true }),
      );
      expect(client.sheets).toBeInstanceOf(WarehouseIssueSheetsService);
      expect(client.receipts).toBeInstanceOf(WarehouseReceiptsService);
      for (const service of [
        WarehouseReceiptItemMappingService,

        WarehouseReceiptReconciliationService,
        WarehouseReceiptConflictResolutionService,
      ])
        expect(fixture.get(service)).toBeInstanceOf(service);
      for (const controller of [
        WarehouseStockController,
        WarehouseTransfersController,
        WarehouseReceiptsController,
        WarehouseIssueSheetsController,
        WarehouseIssuesController,
        WarehouseStockAdjustmentsController,
        WarehouseCatalogController,
        WarehousesController,
        WarehouseStorageLocationsController,
      ]) {
        expect(fixture.get(controller)).toBeInstanceOf(controller);
      }
    } finally {
      await fixture.close();
    }
  });
  it('does not expose the internal Stock query service to importing modules', async () => {
    await expect(
      Test.createTestingModule({
        imports: [WarehouseStockModule],
        providers: [PrivateQueryClient],
      })
        .overrideModule(StorageModule)
        .useModule(StorageFixtureModule)
        .overrideProvider(PrismaService)
        .useValue({})
        .compile(),
    ).rejects.toThrow(/PrivateQueryClient/);
  });
});
