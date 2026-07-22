import { Prisma } from '@prisma/client';

export const equipmentAuditInclude = {
  country: true,
  model: {
    include: {
      manufacturer: true,
    },
  },
  responsibleEmployee: true,
  section: {
    include: {
      workshop: true,
    },
  },
} as const;

export type EquipmentWithAuditRelations = Prisma.EquipmentGetPayload<{
  include: typeof equipmentAuditInclude;
}>;
