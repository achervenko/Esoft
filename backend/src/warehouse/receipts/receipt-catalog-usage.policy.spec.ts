import { WarehouseReceiptIntegrationHandler } from '../receipt-integration/receipt-integration.handler';
jest.mock('@thallesp/nestjs-better-auth', () => ({
  Session: () => () => undefined,
}));
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { WarehouseReceiptsModule } from './receipts.module';
import { WarehouseCatalogUsagePolicy } from '../catalog/catalog-usage.policy';
it('registers pending receipt usage in Catalog through Nest and removes it on shutdown', async () => {
  const fixture = await Test.createTestingModule({
    imports: [WarehouseReceiptsModule],
  })
    .overrideProvider(PrismaService)
    .useValue({})
    .overrideProvider(AuditLogService)
    .useValue({})
    .compile();
  await fixture.init();
  const usage = fixture.get(WarehouseCatalogUsagePolicy);
  const findFirst = jest.fn().mockResolvedValue({ id: 1n });
  const tx = {
    warehouseReceiptLine: { findFirst },
  } as unknown as Prisma.TransactionClient;
  try {
    expect(await usage.isUsed(tx, 10n)).toBe(true);
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        itemId: 10n,
        receipt: { status: { in: ['RECEIVED', 'PLACING'] } },
      },
      select: { id: true },
    });
    expect(() => fixture.get(WarehouseReceiptIntegrationHandler)).toThrow();
  } finally {
    await fixture.close();
  }
  expect(await usage.isUsed(tx, 10n)).toBe(false);
});
