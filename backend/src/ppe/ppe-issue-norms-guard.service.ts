import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, type Gender } from '@prisma/client';
import { ppeNotFound } from './ppe.errors';
import { badPpeRequest } from './ppe.validation';
import {
  employeeSizesSelect,
  type EmployeeSizeValues,
} from './ppe-employee-sizes';

export const issueNormInclude = {
  items: {
    orderBy: { id: 'asc' },
    include: { ppeItem: { include: { sizes: { orderBy: { id: 'asc' } } } } },
  },
} satisfies Prisma.PpeNormInclude;
export type IssueNorm = Prisma.PpeNormGetPayload<{
  include: typeof issueNormInclude;
}>;
export type IssueEmployee = Prisma.EmployeeGetPayload<Record<string, never>> & {
  ppeSizes: EmployeeSizeValues | null;
  additionalPositions?: { positionId: number; assignedAt: Date }[];
};
@Injectable()
export class PpeIssueNormsGuardService {
  async lockEmployee(
    tx: Prisma.TransactionClient,
    id: number,
    requireActive = true,
  ) {
    await tx.$queryRaw`SELECT id FROM employees WHERE id = ${id} FOR UPDATE`;
    const employee = await tx.employee.findUnique({
      where: { id },
      include: {
        ppeSizes: { select: employeeSizesSelect },
        additionalPositions: true,
      },
    });
    if (!employee) ppeNotFound('PPE_EMPLOYEE_NOT_FOUND');
    if (requireActive && !employee.isActive)
      badPpeRequest(
        'PPE_EMPLOYEE_INACTIVE',
        'Нельзя выдать СИЗ отключённому сотруднику.',
      );
    return employee;
  }

  async lockPosition(tx: Prisma.TransactionClient, id: number) {
    await tx.$queryRaw`SELECT id FROM positions WHERE id = ${id} FOR UPDATE`;
    const position = await tx.position.findUnique({ where: { id } });
    if (!position) ppeNotFound('POSITION_NOT_FOUND');
    return position;
  }

  async lockEmployeeNorms(
    tx: Prisma.TransactionClient,
    employee: IssueEmployee,
    date: Date,
    requestedIds: number[] = [],
    future = false,
  ) {
    if (!employee.gender)
      badPpeRequest(
        'PPE_EMPLOYEE_GENDER_REQUIRED',
        'Укажите пол сотрудника для расчёта норм СИЗ.',
      );
    const assignments = [
      {
        positionId: employee.positionId,
        assignedAt: employee.positionAssignedAt,
      },
      ...(employee.additionalPositions ?? []).filter(
        (entry) =>
          entry.positionId !== employee.positionId && entry.assignedAt <= date,
      ),
    ]
      .filter((entry) => !entry.assignedAt || entry.assignedAt <= date)
      .sort((a, b) => a.positionId - b.positionId);
    const current: IssueNorm[] = [],
      upcoming: IssueNorm[] = [];
    const warnings: {
      code: 'PPE_NORM_MISSING';
      positionId: number;
      position: string;
      message: string;
    }[] = [];
    for (const assignment of assignments) {
      const position = await this.lockPosition(tx, assignment.positionId);
      const norm = await this.lockEffectiveNorm(
        tx,
        assignment.positionId,
        date,
        employee.gender,
      );
      if (norm) current.push(norm);
      else
        warnings.push({
          code: 'PPE_NORM_MISSING',
          positionId: assignment.positionId,
          position: position.name,
          message: `Для должности «${position.name}» и пола сотрудника норма не задана.`,
        });
      if (future) {
        const next = await this.lockFutureNorm(
          tx,
          assignment.positionId,
          date,
          employee.gender,
        );
        if (next) upcoming.push(next);
      } else if (requestedIds.length) {
        upcoming.push(
          ...(await this.lockRequestedFutureNorms(
            tx,
            assignment.positionId,
            date,
            requestedIds,
            employee.gender,
          )),
        );
      }
    }
    // The larger quantity wins; equal quantities keep the stable position order.
    const merge = (norms: IssueNorm[]) => {
      const winners = new Map<number, number>();
      const quantities = new Map<number, Prisma.Decimal>();
      for (const norm of norms)
        for (const item of norm.items) {
          if (
            !quantities.has(item.ppeItemId) ||
            item.quantity.gt(quantities.get(item.ppeItemId)!)
          ) {
            winners.set(item.ppeItemId, item.id);
            quantities.set(item.ppeItemId, item.quantity);
          }
        }
      return norms.map((norm) => ({
        ...norm,
        items: norm.items.filter(
          (item) => winners.get(item.ppeItemId) === item.id,
        ),
      }));
    };
    return {
      current: merge(current),
      future: merge(upcoming),
      assignments,
      warnings,
    };
  }

  async lockEffectiveNorm(
    tx: Prisma.TransactionClient,
    positionId: number,
    date: Date,
    gender: Gender,
  ) {
    const candidates = await tx.ppeNorm.findMany({
      where: {
        positionId,
        gender,
        effectiveFrom: { lte: date },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
      },
      select: { id: true },
      take: 2,
    });
    if (candidates.length > 1)
      throw new ConflictException({
        code: 'PPE_NORM_PERIOD_CONFLICT',
        message: 'Найдено несколько действующих норм.',
      });
    if (!candidates[0]) return null;
    await tx.$queryRaw`SELECT id FROM ppe_norms WHERE id = ${candidates[0].id} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM ppe_norm_items WHERE norm_id = ${candidates[0].id} ORDER BY id FOR UPDATE`;
    return tx.ppeNorm.findUnique({
      where: { id: candidates[0].id },
      include: issueNormInclude,
    });
  }

  async lockFutureNorm(
    tx: Prisma.TransactionClient,
    positionId: number,
    date: Date,
    gender: Gender,
  ) {
    const candidate = await tx.ppeNorm.findFirst({
      where: {
        positionId,
        gender,
        effectiveFrom: {
          gt: date,
          lte: new Date(Number(date) + 30 * 86_400_000),
        },
      },
      orderBy: { effectiveFrom: 'asc' },
      select: { id: true },
    });
    if (!candidate) return null;
    await tx.$queryRaw`SELECT id FROM ppe_norms WHERE id = ${candidate.id} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM ppe_norm_items WHERE norm_id = ${candidate.id} ORDER BY id FOR UPDATE`;
    return tx.ppeNorm.findUnique({
      where: { id: candidate.id },
      include: issueNormInclude,
    });
  }

  async lockRequestedFutureNorms(
    tx: Prisma.TransactionClient,
    positionId: number,
    date: Date,
    itemIds: number[],
    gender: Gender,
  ) {
    const candidates = await tx.ppeNorm.findMany({
      where: {
        positionId,
        gender,
        effectiveFrom: { gt: date },
        items: { some: { id: { in: itemIds } } },
      },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    if (!candidates.length) return [];
    const ids = candidates.map((norm) => norm.id);
    await tx.$queryRaw`SELECT id FROM ppe_norms WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM ppe_norm_items WHERE norm_id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;
    return tx.ppeNorm.findMany({
      where: { id: { in: ids } },
      include: issueNormInclude,
      orderBy: { id: 'asc' },
    });
  }
}
