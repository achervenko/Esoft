import { Injectable } from '@nestjs/common';
import { AuditAction, type Prisma } from '@prisma/client';
import { PpeNormsAuditService } from './ppe-norms-audit.service';
import { type PpeNormRecord } from './ppe-norms.mapper';
import type { parseNormRevision } from './ppe-norms.validation';
type NormContent = ReturnType<typeof parseNormRevision>;
import { PpeNormsPersistenceService } from './ppe-norms-persistence.service';
@Injectable()
export class PpeNormsFutureItemsService {
  constructor(
    private readonly persistence: PpeNormsPersistenceService,
    private readonly normAudit: PpeNormsAuditService,
  ) {}
  async replace(
    tx: Prisma.TransactionClient,
    previous: PpeNormRecord,
    data: NormContent,
    actorUserId: string,
  ) {
    const nextItemIds = new Set(data.items.map((item) => item.ppeItemId));
    for (const item of previous.items) {
      if (!nextItemIds.has(item.ppeItemId)) {
        await tx.ppeNormItem.delete({ where: { id: item.id } });
        await this.normAudit.auditItem(
          tx,
          AuditAction.DELETE,
          item,
          null,
          actorUserId,
        );
      }
    }
    const previousItems = new Map(
      previous.items.map((item) => [item.ppeItemId, item]),
    );
    for (const item of data.items) {
      const snapshot = await this.persistence.itemSnapshot(tx, item.ppeItemId);
      const oldItem = previousItems.get(item.ppeItemId);
      if (oldItem) {
        if (
          oldItem.quantity.toNumber() !== item.quantity ||
          oldItem.periodCount !== item.periodCount ||
          oldItem.periodUnit !== item.periodUnit ||
          oldItem.ppeNameSnapshot !== snapshot.ppeNameSnapshot ||
          oldItem.ppeUnitSnapshot !== snapshot.ppeUnitSnapshot ||
          oldItem.ppeItemTypeSnapshot !== snapshot.ppeItemTypeSnapshot
        ) {
          const updated = await tx.ppeNormItem.update({
            where: { id: oldItem.id },
            data: {
              ...snapshot,
              quantity: item.quantity,
              periodCount: item.periodCount,
              periodUnit: item.periodUnit,
            },
            include: { ppeItem: true },
          });
          await this.normAudit.auditItem(
            tx,
            AuditAction.UPDATE,
            oldItem,
            updated,
            actorUserId,
          );
        }
      } else {
        const created = await tx.ppeNormItem.create({
          data: { ...item, ...snapshot, normId: previous.id },
          include: { ppeItem: true },
        });
        await this.normAudit.auditItem(
          tx,
          AuditAction.CREATE,
          null,
          created,
          actorUserId,
        );
      }
    }
  }
}
