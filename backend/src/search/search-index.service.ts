import { Injectable } from '@nestjs/common';
import type { SearchIndexEntry, SearchIndexTx } from './search.types';

@Injectable()
export class SearchIndexService {
  upsert(tx: SearchIndexTx, entry: SearchIndexEntry) {
    return tx.searchIndex.upsert({
      where: {
        entityType_entityId: {
          entityType: entry.entityType,
          entityId: entry.entityId,
        },
      },
      create: {
        entityType: entry.entityType,
        entityId: entry.entityId,
        title: entry.title,
        subtitle: entry.subtitle,
        searchText: entry.searchText,
        isActive: entry.isActive ?? true,
      },
      update: {
        title: entry.title,
        subtitle: entry.subtitle,
        searchText: entry.searchText,
        isActive: entry.isActive ?? true,
      },
    });
  }

  activate(tx: SearchIndexTx, entityType: string, entityId: number) {
    return tx.searchIndex.updateMany({
      where: { entityType, entityId },
      data: { isActive: true },
    });
  }

  deactivate(tx: SearchIndexTx, entityType: string, entityId: number) {
    return tx.searchIndex.updateMany({
      where: { entityType, entityId },
      data: { isActive: false },
    });
  }

  remove(tx: SearchIndexTx, entityType: string, entityId: number) {
    return tx.searchIndex.deleteMany({
      where: { entityType, entityId },
    });
  }
}
