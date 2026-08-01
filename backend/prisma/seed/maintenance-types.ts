import { PrismaClient } from '@prisma/client';

const maintenanceTypes = [
  {
    code: 'maintenance_1',
    name: 'ТО-1',
    sortOrder: 10,
  },
  {
    code: 'maintenance_2',
    name: 'ТО-2',
    sortOrder: 20,
  },
  {
    code: 'repair',
    name: 'Ремонт',
    sortOrder: 30,
  },
  {
    code: 'diagnostics',
    name: 'Диагностика',
    sortOrder: 40,
  },
] as const;

export async function seedMaintenanceTypes(
  prisma: PrismaClient,
): Promise<void> {
  await prisma.$transaction(
    maintenanceTypes.map((maintenanceType) =>
      prisma.equipmentEventType.upsert({
        create: {
          ...maintenanceType,
          isActive: true,
        },
        update: {
          isActive: true,
          name: maintenanceType.name,
          sortOrder: maintenanceType.sortOrder,
        },
        where: {
          code: maintenanceType.code,
        },
      }),
    ),
  );
}
