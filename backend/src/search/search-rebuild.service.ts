import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  EQUIPMENT_SEARCH_ENTITY_TYPE,
  SEARCH_REBUILD_BATCH_SIZE,
  SEARCH_REBUILD_LOCK_KEY,
} from './search.constants';
import { EquipmentSearchProjector } from './equipment-search.projector';
import type { SearchIndexTx, SearchRebuildResultDto } from './search.types';

type AdvisoryLockRow = {
  locked: boolean;
};

@Injectable()
export class SearchRebuildService {
  constructor(
    private readonly equipmentProjector: EquipmentSearchProjector,
    private readonly prisma: PrismaService,
  ) {}

  rebuildAll() {
    return this.runWithLock('all', async (tx) => {
      const equipmentResult = await this.rebuildEquipment(tx);

      return {
        ...equipmentResult,
        entityType: 'all',
      };
    });
  }

  rebuildEntityType(entityType: string) {
    if (entityType !== EQUIPMENT_SEARCH_ENTITY_TYPE) {
      throw new BadRequestException({
        code: 'UNSUPPORTED_ENTITY_TYPE',
        message: 'Unsupported search index entity type.',
      });
    }

    return this.runWithLock(entityType, (tx) => this.rebuildEquipment(tx));
  }

  private async runWithLock(
    entityType: string,
    rebuild: (
      tx: SearchIndexTx,
    ) => Promise<Omit<SearchRebuildResultDto, 'durationMs' | 'completedAt'>>,
  ): Promise<SearchRebuildResultDto> {
    const startedAt = Date.now();

    return this.prisma.$transaction(
      async (tx) => {
        const [lock] = await tx.$queryRaw<AdvisoryLockRow[]>`
          SELECT pg_try_advisory_xact_lock(${SEARCH_REBUILD_LOCK_KEY}) AS locked
        `;

        if (!lock?.locked) {
          throw new ConflictException({
            code: 'SEARCH_REBUILD_ALREADY_RUNNING',
            message: 'Search index rebuild is already running.',
          });
        }

        const result = await rebuild(tx);

        return {
          entityType: result.entityType || entityType,
          processed: result.processed,
          durationMs: Date.now() - startedAt,
          completedAt: new Date().toISOString(),
        };
      },
      {
        maxWait: 10_000,
        timeout: 120_000,
      },
    );
  }

  private async rebuildEquipment(
    tx: SearchIndexTx,
  ): Promise<Omit<SearchRebuildResultDto, 'durationMs' | 'completedAt'>> {
    await tx.searchIndex.updateMany({
      where: { entityType: EQUIPMENT_SEARCH_ENTITY_TYPE },
      data: { isActive: false },
    });

    let processed = 0;
    let lastId = 0;

    while (true) {
      const batch = await tx.equipment.findMany({
        where: { id: { gt: lastId } },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: SEARCH_REBUILD_BATCH_SIZE,
      });

      if (batch.length === 0) {
        break;
      }

      for (const item of batch) {
        await this.equipmentProjector.upsertEquipment(tx, item.id);
        processed += 1;
        lastId = item.id;
      }
    }

    return {
      entityType: EQUIPMENT_SEARCH_ENTITY_TYPE,
      processed,
    };
  }
}
