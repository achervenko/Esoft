import {
  warehouseItemSummarySelect,
  warehouseItemSummaryDto,
} from '../catalog/catalog.dto';
import {
  locationWithWarehouseSelect,
  locationWithWarehouseDto,
} from '../storage-structure/storage-structure.dto';
import { Prisma } from '@prisma/client';
export const reservationInclude = {
  project: {
    select: { id: true, projectNumber: true, name: true, isActive: true },
  },
  balance: {
    include: {
      item: { select: warehouseItemSummarySelect },
      storageLocation: {
        select: locationWithWarehouseSelect,
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
    item: warehouseItemSummaryDto(r.balance.item),
    location: locationWithWarehouseDto(r.balance.storageLocation),
    project: { ...r.project, id: String(r.project.id) },
  };
}
