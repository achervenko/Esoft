import { Injectable } from '@nestjs/common';
import { AuditAction, type Prisma } from '@prisma/client';
import { getBusinessTodayDate } from '../application/business-date';
import { PpeNormsGuardsService } from './ppe-norms-guards.service';
import { PpeNormsAuditService } from './ppe-norms-audit.service';
import { PpeNormsPersistenceService } from './ppe-norms-persistence.service';
import {
  normInclude,
  toPpeNormDto,
  type PpeNormRecord,
} from './ppe-norms.mapper';
import { parseNormId, parseNormRevision } from './ppe-norms.validation';

type NormContent = ReturnType<typeof parseNormRevision>;

@Injectable()
export class PpeNormsFutureService {
  constructor(
    private readonly guards: PpeNormsGuardsService,
    private readonly normAudit: PpeNormsAuditService,
    private readonly persistence: PpeNormsPersistenceService,
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
      const movePredecessor = await this.prepareFutureBoundaryMove(
        tx,
        previous,
        data,
        actorUserId,
      );
      // Shorten first, extend last: the exclusion constraint stays satisfied
      // throughout the transaction, including when the boundary moves earlier.
      if (movePredecessor && data.effectiveFrom < previous.effectiveFrom)
        await movePredecessor();

      await this.replaceFutureItems(tx, previous, data, actorUserId);
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
      if (movePredecessor && data.effectiveFrom > previous.effectiveFrom)
        await movePredecessor();
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
      const predecessor = await tx.ppeNorm.findFirst({
        where: {
          positionId: previous.positionId,
          effectiveFrom: { lt: previous.effectiveFrom },
        },
        orderBy: { effectiveFrom: 'desc' },
        include: normInclude,
      });
      const successor = await tx.ppeNorm.findFirst({
        where: {
          positionId: previous.positionId,
          effectiveFrom: { gt: previous.effectiveFrom },
        },
        orderBy: { effectiveFrom: 'asc' },
        select: { effectiveFrom: true },
      });
      // The position lock serializes deletion, revisions and issue plans.
      // Repair ancestry before ON DELETE SET NULL can sever the chain.
      const descendants = await tx.ppeNorm.findMany({
        where: { previousNormId: id },
        include: normInclude,
      });
      for (const descendant of descendants) {
        const next = await tx.ppeNorm.update({
          where: { id: descendant.id },
          data: { previousNormId: predecessor?.id ?? null },
          include: normInclude,
        });
        await this.normAudit.auditNorm(
          tx,
          AuditAction.UPDATE,
          descendant,
          next,
          actorUserId,
        );
      }
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
      if (predecessor) {
        const effectiveTo = successor
          ? new Date(successor.effectiveFrom.getTime() - 86_400_000)
          : null;
        const restored = await tx.ppeNorm.update({
          where: { id: predecessor.id },
          data: { effectiveTo },
          include: normInclude,
        });
        await this.normAudit.auditNorm(
          tx,
          AuditAction.UPDATE,
          predecessor,
          restored,
          actorUserId,
        );
      }
      return { id };
    });
  }

  private async prepareFutureBoundaryMove(
    tx: Prisma.TransactionClient,
    previous: PpeNormRecord,
    data: NormContent,
    actorUserId: string,
  ) {
    const predecessor = await tx.ppeNorm.findFirst({
      where: {
        positionId: previous.positionId,
        effectiveFrom: { lt: previous.effectiveFrom },
      },
      orderBy: { effectiveFrom: 'desc' },
      include: normInclude,
    });
    const successor = await tx.ppeNorm.findFirst({
      where: {
        positionId: previous.positionId,
        effectiveFrom: { gt: previous.effectiveFrom },
      },
      orderBy: { effectiveFrom: 'asc' },
      select: { effectiveFrom: true },
    });
    // Preserve revision order and only move an automatically joined boundary.
    // Explicitly ended, independent periods must not be silently reopened.
    if (
      (predecessor && data.effectiveFrom <= predecessor.effectiveFrom) ||
      (successor && data.effectiveFrom >= successor.effectiveFrom)
    )
      this.guards.periodConflict();
    const movesBoundary =
      predecessor &&
      previous.previousNormId === predecessor.id &&
      predecessor.effectiveTo?.getTime() ===
        previous.effectiveFrom.getTime() - 86_400_000 &&
      data.effectiveFrom.getTime() !== previous.effectiveFrom.getTime();
    const predecessorEnd = new Date(data.effectiveFrom.getTime() - 86_400_000);
    await this.guards.assertNoOverlap(
      tx,
      previous.positionId,
      data,
      movesBoundary ? [previous.id, predecessor.id] : previous.id,
    );
    if (
      movesBoundary &&
      (await tx.ppeIssue.count({
        where: {
          normItem: { normId: predecessor.id },
          issuedAt: { gt: predecessorEnd },
        },
      }))
    )
      this.guards.locked();
    const movePredecessor = async () => {
      if (!movesBoundary) return;
      const next = await tx.ppeNorm.update({
        where: { id: predecessor.id },
        data: { effectiveTo: predecessorEnd },
        include: normInclude,
      });
      await this.normAudit.auditNorm(
        tx,
        AuditAction.UPDATE,
        predecessor,
        next,
        actorUserId,
      );
    };
    return movesBoundary ? movePredecessor : null;
  }

  private async replaceFutureItems(
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
          (item.calculationMode !== undefined &&
            oldItem.calculationMode !== item.calculationMode) ||
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
              ...(item.calculationMode !== undefined
                ? { calculationMode: item.calculationMode }
                : {}),
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
