import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { throwBadRequest } from './users-admin.validation';
import { getBusinessTodayDate } from '../application/business-date';
@Injectable()
export class EmployeePositionAssignmentsService {
  async assertPosition(
    tx: Prisma.TransactionClient,
    id: number,
    currentId?: number,
  ) {
    const rows = await tx.$queryRaw<Array<{ isActive: boolean }>>`
      SELECT is_active AS "isActive" FROM positions WHERE id = ${id} FOR SHARE
    `;
    if (!rows[0]) {
      throwBadRequest('POSITION_NOT_FOUND', 'Должность не найдена.');
    }
    if (!rows[0].isActive && id !== currentId) {
      throwBadRequest('POSITION_INACTIVE', 'Выберите активную должность.');
    }
  }

  async create(tx: Prisma.TransactionClient, ids: number[]) {
    for (const id of [...ids].sort((a, b) => a - b))
      await this.assertPosition(tx, id);
    return {
      create: ids.map((positionId) => ({
        positionId,
        assignedAt: getBusinessTodayDate(),
      })),
    };
  }
  async update(
    tx: Prisma.TransactionClient,
    primaryId: number,
    ids: number[] | undefined,
    previous: {
      positionId: number;
      positionAssignedAt: Date | null;
      additionalPositions: { positionId: number; assignedAt: Date }[];
    },
  ) {
    const previousIds = previous.additionalPositions.map(
      (entry) => entry.positionId,
    );
    const assignedDates = new Map<number, Date | null>(
      previous.additionalPositions.map((entry) => [
        entry.positionId,
        entry.assignedAt,
      ]),
    );
    assignedDates.set(previous.positionId, previous.positionAssignedAt);
    const nextIds = (ids ?? previousIds).filter((id) => id !== primaryId);
    for (const id of [...nextIds].sort((a, b) => a - b))
      await this.assertPosition(tx, id, assignedDates.has(id) ? id : undefined);
    return {
      additionalPositions: {
        deleteMany: { positionId: { notIn: nextIds } },
        create: nextIds
          .filter((id) => !previousIds.includes(id))
          .map((positionId) => ({
            positionId,
            assignedAt: assignedDates.get(positionId) ?? getBusinessTodayDate(),
          })),
      },
      ...(primaryId !== previous.positionId
        ? {
            positionAssignedAt:
              assignedDates.get(primaryId) ?? getBusinessTodayDate(),
          }
        : {}),
    };
  }
}
