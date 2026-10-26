import { Prisma } from '@prisma/client';
export const reservationInclude = {
  project: {
    select: { id: true, projectNumber: true, name: true, isActive: true },
  },
  balance: {
    include: {
      item: {
        select: {
          id: true,
          article: true,
          name: true,
          unit: true,
          isActive: true,
        },
      },
      storageLocation: {
        select: { id: true, code: true, name: true, isActive: true },
      },
    },
  },
} satisfies Prisma.WarehouseProjectReservationInclude;
type Row = Prisma.WarehouseProjectReservationGetPayload<{
  include: typeof reservationInclude;
}>;
export function reservationDto(r: Row) {
  return {
    id: String(r.id),
    balanceId: String(r.balanceId),
    projectId: String(r.projectId),
    quantity: r.quantity.toString(),
    item: { ...r.balance.item, id: String(r.balance.item.id) },
    location: {
      ...r.balance.storageLocation,
      id: String(r.balance.storageLocation.id),
    },
    project: { ...r.project, id: String(r.project.id) },
  };
}
