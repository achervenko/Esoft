import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
export type CatalogUsageCheck = (
  tx: Prisma.TransactionClient,
  itemId: bigint,
) => Promise<boolean>;
@Injectable()
export class WarehouseCatalogUsagePolicy {
  private readonly checks = new Map<string, CatalogUsageCheck>();
  register(owner: string, check: CatalogUsageCheck) {
    if (this.checks.has(owner))
      throw new Error('Catalog usage check is already registered: ' + owner);
    this.checks.set(owner, check);
    return () => {
      if (this.checks.get(owner) === check) this.checks.delete(owner);
    };
  }
  // Call after the item's FOR UPDATE lock. Checks must be read-only and take no document locks.
  async isUsed(tx: Prisma.TransactionClient, itemId: bigint) {
    for (const check of this.checks.values())
      if (await check(tx, itemId)) return true;
    return false;
  }
}
