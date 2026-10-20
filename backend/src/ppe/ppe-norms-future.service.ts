import { PpeNormsFutureBoundaryService } from './ppe-norms-future-boundary.service';
import { PpeNormsFutureItemsService } from './ppe-norms-future-items.service';
import { Injectable } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { getBusinessTodayDate } from '../application/business-date';
import { PpeNormsGuardsService } from './ppe-norms-guards.service';
import { PpeNormsAuditService } from './ppe-norms-audit.service';
import { PpeNormsPersistenceService } from './ppe-norms-persistence.service';
import { normInclude, toPpeNormDto } from './ppe-norms.mapper';
import { parseNormId, parseNormRevision } from './ppe-norms.validation';

@Injectable()
export class PpeNormsFutureService {
  constructor(
    private readonly guards: PpeNormsGuardsService,
    private readonly normAudit: PpeNormsAuditService,
    private readonly persistence: PpeNormsPersistenceService,
    private readonly boundaries: PpeNormsFutureBoundaryService,
    private readonly items: PpeNormsFutureItemsService,
  ) {}

  update(id: number, payload: unknown, actorUserId: string) {
    parseNormId(id);
    const data = parseNormRevision(payload);
    return this.persistence.mutate(async (tx) => {
      const previous = await this.guards.lockNorm(tx, id);
      const today = getBusinessTodayDate();
      if (previous.effectiveFrom <= today || data.effectiveFrom <= today)
        this.guards.locked();
      if (await tx.ppeIssue.count({ where: { normItem: { normId: id } } }))
        this.guards.locked();
      await this.guards.lockCatalog(tx, data.items);
      const boundary = await this.boundaries.prepareMove(
        tx,
        previous,
        data,
        actorUserId,
      );
      await boundary.beforeUpdate();
      await this.items.replace(tx, previous, data, actorUserId);
      const norm = await tx.ppeNorm.update({
        where: { id },
        data: {
          effectiveFrom: data.effectiveFrom,
          effectiveTo: data.effectiveTo,
          ...(data.transitionMode !== undefined
            ? { transitionMode: data.transitionMode }
            : {}),
        },
        include: normInclude,
      });
      await boundary.afterUpdate();
      await this.normAudit.auditNorm(
        tx,
        AuditAction.UPDATE,
        previous,
        norm,
        actorUserId,
      );
      return toPpeNormDto(norm);
    });
  }

  delete(id: number, actorUserId: string) {
    parseNormId(id);
    return this.persistence.mutate(async (tx) => {
      const previous = await this.guards.lockNorm(tx, id);
      if (
        previous.effectiveFrom <= getBusinessTodayDate() ||
        (await tx.ppeIssue.count({ where: { normItem: { normId: id } } }))
      )
        this.guards.locked();
      const boundary = await this.boundaries.prepareDelete(
        tx,
        previous,
        actorUserId,
      );
      // Delete first to avoid the period exclusion constraint while reopening
      // the predecessor. Both changes and their audit commit together.
      for (const item of previous.items)
        await this.normAudit.auditItem(
          tx,
          AuditAction.DELETE,
          item,
          null,
          actorUserId,
        );
      await this.normAudit.auditNorm(
        tx,
        AuditAction.DELETE,
        previous,
        null,
        actorUserId,
      );
      await tx.ppeNorm.delete({ where: { id } });
      await boundary.restore();
      return { id };
    });
  }
}
