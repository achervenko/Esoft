import { Injectable } from '@nestjs/common';
import { AuditAction, type Prisma } from '@prisma/client';
import { PpeNormsAuditService } from './ppe-norms-audit.service';
import { normInclude, type PpeNormRecord } from './ppe-norms.mapper';
import type { parseNormRevision } from './ppe-norms.validation';
type NormContent = ReturnType<typeof parseNormRevision>;
import { PpeNormsGuardsService } from './ppe-norms-guards.service';
@Injectable()
export class PpeNormsFutureBoundaryService {
  constructor(
    private readonly guards: PpeNormsGuardsService,
    private readonly normAudit: PpeNormsAuditService,
  ) {}
  private isJoined(
    previous: PpeNormRecord,
    predecessor: PpeNormRecord | null,
  ): predecessor is PpeNormRecord {
    return (
      predecessor !== null &&
      previous.previousNormId === predecessor.id &&
      predecessor.effectiveTo?.getTime() ===
        previous.effectiveFrom.getTime() - 86_400_000
    );
  }
  private async neighbors(
    tx: Prisma.TransactionClient,
    previous: PpeNormRecord,
  ) {
    const predecessor = await tx.ppeNorm.findFirst({
      where: {
        positionId: previous.positionId,
        gender: previous.gender,
        effectiveFrom: { lt: previous.effectiveFrom },
      },
      orderBy: { effectiveFrom: 'desc' },
      include: normInclude,
    });
    const successor = await tx.ppeNorm.findFirst({
      where: {
        positionId: previous.positionId,
        gender: previous.gender,
        effectiveFrom: { gt: previous.effectiveFrom },
      },
      orderBy: { effectiveFrom: 'asc' },
      select: { effectiveFrom: true },
    });
    return { predecessor, successor };
  }
  async prepareMove(
    tx: Prisma.TransactionClient,
    previous: PpeNormRecord,
    data: NormContent,
    actorUserId: string,
  ) {
    const { predecessor, successor } = await this.neighbors(tx, previous);
    // Preserve revision order and only move an automatically joined boundary.
    // Explicitly ended, independent periods must not be silently reopened.
    if (
      (predecessor && data.effectiveFrom <= predecessor.effectiveFrom) ||
      (successor && data.effectiveFrom >= successor.effectiveFrom)
    )
      this.guards.periodConflict();
    const movesBoundary =
      predecessor &&
      this.isJoined(previous, predecessor) &&
      data.effectiveFrom.getTime() !== previous.effectiveFrom.getTime();
    const predecessorEnd = new Date(data.effectiveFrom.getTime() - 86_400_000);
    await this.guards.assertNoOverlap(
      tx,
      previous.positionId,
      { ...data, gender: previous.gender },
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
    // Shorten before updating the norm; extend after it to preserve period constraints.
    return {
      beforeUpdate: async () => {
        if (data.effectiveFrom < previous.effectiveFrom)
          await movePredecessor();
      },
      afterUpdate: async () => {
        if (data.effectiveFrom > previous.effectiveFrom)
          await movePredecessor();
      },
    };
  }

  async prepareDelete(
    tx: Prisma.TransactionClient,
    previous: PpeNormRecord,
    actorUserId: string,
  ) {
    const { predecessor, successor } = await this.neighbors(tx, previous);
    // The position lock serializes deletion, revisions and issue plans.
    // Repair ancestry before ON DELETE SET NULL can sever the chain.
    const descendants = await tx.ppeNorm.findMany({
      where: { previousNormId: previous.id },
      include: normInclude,
    });
    for (const descendant of descendants) {
      const next = await tx.ppeNorm.update({
        where: { id: descendant.id },
        data: { previousNormId: previous.previousNormId },
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
    return {
      restore: async () => {
        if (this.isJoined(previous, predecessor)) {
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
      },
    };
  }
}
