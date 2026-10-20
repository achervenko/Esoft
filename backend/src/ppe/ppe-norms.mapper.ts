import { Prisma } from '@prisma/client';

export const normInclude = {
  position: { select: { name: true } },
  items: {
    orderBy: { id: 'asc' },
    include: {
      ppeItem: {
        select: { article: true, name: true, unit: true, isActive: true },
      },
    },
  },
} satisfies Prisma.PpeNormInclude;

export type PpeNormRecord = Prisma.PpeNormGetPayload<{
  include: typeof normInclude;
}>;

export function normDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function toPpeNormDto(norm: PpeNormRecord) {
  return {
    id: norm.id,
    positionId: norm.positionId,
    gender: norm.gender,
    position: norm.position.name,
    effectiveFrom: normDateString(norm.effectiveFrom),
    effectiveTo: norm.effectiveTo ? normDateString(norm.effectiveTo) : null,
    transitionMode: norm.transitionMode,
    items: norm.items.map((item) => ({
      id: item.id,
      ppeItemId: item.ppeItemId,
      article: item.ppeItem.article,
      name: item.ppeNameSnapshot,
      unit: item.ppeUnitSnapshot,
      isActive: item.ppeItem.isActive,
      quantity: item.quantity.toNumber(),
      periodCount: item.periodCount,
      periodUnit: item.periodUnit,
    })),
  };
}
