import { ConflictException, Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PpeNormsAuditService } from './ppe-norms-audit.service';
import { ppeNotFound, rethrowPpeError } from './ppe.errors';
import { normInclude, toPpeNormDto } from './ppe-norms.mapper';
import type { parseNormRevision } from './ppe-norms.validation';

type NormContent = ReturnType<typeof parseNormRevision>;

@Injectable()
export class PpeNormsPersistenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly normAudit: PpeNormsAuditService,
  ) {}

  async createInTransaction(
    tx: Prisma.TransactionClient,
    positionId: number,
    data: NormContent,
    actorUserId: string,
    previousNormId?: number,
  ) {
    const norm = await tx.ppeNorm.create({
      data: {
        positionId,
        effectiveFrom: data.effectiveFrom,
        effectiveTo: data.effectiveTo,
        transitionMode:
          data.transitionMode ?? (previousNormId ? 'SOFT' : 'LEGACY'),
        previousNormId,
      },
      include: normInclude,
    });
    await this.normAudit.auditNorm(
      tx,
      AuditAction.CREATE,
      null,
      norm,
      actorUserId,
    );
    for (const item of data.items) {
      const created = await tx.ppeNormItem.create({
        data: {
          ...item,
          ...(await this.itemSnapshot(tx, item.ppeItemId)),
          normId: norm.id,
        },
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
    const result = await tx.ppeNorm.findUnique({
      where: { id: norm.id },
      include: normInclude,
    });
    if (!result) ppeNotFound('PPE_NORM_NOT_FOUND');
    return toPpeNormDto(result);
  }

  async itemSnapshot(tx: Prisma.TransactionClient, id: number) {
    const item = await tx.ppeItem.findUniqueOrThrow({ where: { id } });
    return {
      ppeNameSnapshot: item.name,
      ppeUnitSnapshot: item.unit,
      ppeItemTypeSnapshot: item.type,
    };
  }

  async mutate<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) {
    try {
      return await this.prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 15_000,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') ppeNotFound('PPE_NORM_NOT_FOUND');
        if (error.code === 'P2003' || error.code === 'P2034') {
          throw new ConflictException({
            code: 'PPE_NORM_REFERENCE_CONFLICT',
            message:
              'Связанные данные изменились. Обновите данные и повторите операцию.',
          });
        }
      }
      rethrowPpeError(error);
    }
  }
}
