import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, PpeItemType } from '@prisma/client';
import { ppeNotFound } from './ppe.errors';
import { badPpeRequest } from './ppe.validation';
import { normalizePpeSizeText } from './ppe-size-text';
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
};
export type IssueCatalogItem = Prisma.PpeItemGetPayload<{
  include: { sizes: true };
}>;
export type PpeIssueWarning = {
  code: 'PPE_SIZE_DIFFERS_FROM_RECOMMENDED';
  message: string;
};

function matchesRecommendedSize(
  type: PpeItemType,
  value: string,
  recommended: string | null,
) {
  return (
    (recommended !== null &&
      normalizePpeSizeText(value) === normalizePpeSizeText(recommended)) ||
    (type === PpeItemType.FEET &&
      recommended !== null &&
      /^\d+(\.\d+)?$/.test(value) &&
      Number(value) === Number(recommended))
  );
}

@Injectable()
export class PpeIssuesGuardsService {
  async lockEmployee(
    tx: Prisma.TransactionClient,
    id: number,
    requireActive = true,
  ) {
    await tx.$queryRaw`SELECT id FROM employees WHERE id = ${id} FOR UPDATE`;
    const employee = await tx.employee.findUnique({
      where: { id },
      include: { ppeSizes: { select: employeeSizesSelect } },
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

  async lockEffectiveNorm(
    tx: Prisma.TransactionClient,
    positionId: number,
    date: Date,
  ) {
    const candidates = await tx.ppeNorm.findMany({
      where: {
        positionId,
        effectiveFrom: { lte: date },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
      },
      select: { id: true },
      take: 2,
    });
    if (candidates.length > 1)
      this.conflict(
        'PPE_NORM_PERIOD_CONFLICT',
        'Найдено несколько действующих норм.',
      );
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
  ) {
    const candidate = await tx.ppeNorm.findFirst({
      where: {
        positionId,
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
  ) {
    const candidates = await tx.ppeNorm.findMany({
      where: {
        positionId,
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

  async lockCatalog(
    tx: Prisma.TransactionClient,
    ids: number[],
    requireActive: boolean,
  ) {
    const uniqueIds = [...new Set(ids)].sort((a, b) => a - b);
    if (!uniqueIds.length) return new Map<number, IssueCatalogItem>();
    await tx.$queryRaw`SELECT id FROM ppe_items WHERE id IN (${Prisma.join(uniqueIds)}) ORDER BY id FOR UPDATE`;
    const items = await tx.ppeItem.findMany({
      where: { id: { in: uniqueIds } },
      include: { sizes: { orderBy: { id: 'asc' } } },
    });
    if (items.length !== uniqueIds.length) ppeNotFound('PPE_ITEM_NOT_FOUND');
    if (requireActive && items.some((item) => !item.isActive))
      badPpeRequest('PPE_ITEM_INACTIVE', 'Выдавать можно только активные СИЗ.');
    return new Map(items.map((item) => [item.id, item]));
  }

  recommendSize(employee: IssueEmployee, item: IssueCatalogItem) {
    let recommendedValue: string | null = null;
    switch (item.type) {
      case PpeItemType.BODY:
        recommendedValue = employee.ppeSizes?.clothingSize ?? null;
        break;
      case PpeItemType.TSHIRT:
        recommendedValue = employee.ppeSizes?.tshirtSize ?? null;
        break;
      case PpeItemType.FEET:
        recommendedValue = employee.ppeSizes?.shoeSize?.toString() ?? null;
        break;
      case PpeItemType.HANDS:
        recommendedValue = employee.ppeSizes?.gloveSize ?? null;
        break;
      case PpeItemType.HEAD:
        recommendedValue = employee.ppeSizes?.headwearSize ?? null;
        break;
    }
    const height =
      item.type === PpeItemType.TSHIRT
        ? employee.ppeSizes?.tshirtHeight
        : employee.ppeSizes?.clothingHeight;
    const activeSizes = item.sizes.filter((size) => size.isActive);
    const matching =
      item.type === PpeItemType.OTHER
        ? undefined
        : activeSizes.find(
            (size) =>
              matchesRecommendedSize(item.type, size.value, recommendedValue) &&
              ((item.type !== PpeItemType.BODY &&
                item.type !== PpeItemType.TSHIRT) ||
                (height != null &&
                  size.heightValue !== null &&
                  normalizePpeSizeText(size.heightValue) ===
                    normalizePpeSizeText(height))),
          );
    return {
      type: item.type,
      recommendedValue,
      recommendedSizeId: matching?.id ?? null,
      recommendedSizeValue: matching?.value ?? null,
      recommendedHeightValue: matching?.heightValue ?? null,
      heightValue:
        item.type === PpeItemType.BODY || item.type === PpeItemType.TSHIRT
          ? (height ?? null)
          : null,
      requiresSelection:
        item.type !== PpeItemType.OTHER && item.sizes.length > 0 && !matching,
      activeSizes: activeSizes.map(({ id, value, heightValue }) => ({
        id,
        value,
        heightValue,
      })),
    };
  }

  assertActive(item: IssueCatalogItem) {
    if (!item.isActive)
      badPpeRequest('PPE_ITEM_INACTIVE', 'Выдавать можно только активные СИЗ.');
  }

  assertReplacement(
    normItem: Pick<
      IssueNorm['items'][number],
      'ppeItemTypeSnapshot' | 'ppeUnitSnapshot'
    >,
    actual: Pick<IssueCatalogItem, 'type' | 'unit'>,
  ) {
    if (
      actual.type !== normItem.ppeItemTypeSnapshot ||
      actual.unit !== normItem.ppeUnitSnapshot
    )
      badPpeRequest(
        'PPE_REPLACEMENT_INCOMPATIBLE',
        'Замена должна иметь тот же тип СИЗ и единицу измерения, что и позиция нормы.',
      );
  }

  resolveSize(
    employee: IssueEmployee,
    item: IssueCatalogItem,
    sizeId: number | null,
  ) {
    const recommendation = this.recommendSize(employee, item);
    const height = recommendation.heightValue;
    if (item.type === PpeItemType.OTHER || item.sizes.length === 0) {
      if (sizeId !== null)
        badPpeRequest(
          'PPE_SIZE_NOT_FOUND',
          'Размер не предусмотрен для этой позиции СИЗ.',
        );
      return {
        sizeValue: null,
        heightSnapshot: null,
        warnings: [] as PpeIssueWarning[],
      };
    }
    const selectedId = sizeId ?? recommendation.recommendedSizeId;
    if (selectedId === null)
      badPpeRequest(
        'PPE_SIZE_REQUIRED',
        'Выберите активный размер этой позиции СИЗ.',
      );
    const selected = item.sizes.find((size) => size.id === selectedId);
    if (!selected) ppeNotFound('PPE_SIZE_NOT_FOUND');
    if (!selected.isActive)
      badPpeRequest('PPE_SIZE_INACTIVE', 'Выбранный размер отключён.');
    return {
      sizeValue: selected.value,
      heightSnapshot:
        item.type === PpeItemType.BODY || item.type === PpeItemType.TSHIRT
          ? selected.heightValue
          : null,
      warnings:
        (recommendation.recommendedValue !== null &&
          !matchesRecommendedSize(
            item.type,
            selected.value,
            recommendation.recommendedValue,
          )) ||
        ((item.type === PpeItemType.BODY || item.type === PpeItemType.TSHIRT) &&
          height != null &&
          (selected.heightValue === null ||
            normalizePpeSizeText(selected.heightValue) !==
              normalizePpeSizeText(height)))
          ? ([
              {
                code: 'PPE_SIZE_DIFFERS_FROM_RECOMMENDED',
                message:
                  'Выбранный размер отличается от рекомендуемого размера сотрудника.',
              },
            ] as PpeIssueWarning[])
          : ([] as PpeIssueWarning[]),
    };
  }

  async actorName(tx: Prisma.TransactionClient, userId: string) {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    if (!user) ppeNotFound('PPE_ISSUE_ACTOR_NOT_FOUND');
    return user.name;
  }

  conflict(code: string, message: string): never {
    throw new ConflictException({ code, message });
  }
}
