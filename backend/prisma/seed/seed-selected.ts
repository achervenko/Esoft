import type { PrismaClient } from '@prisma/client';
import { seedCalendar } from './calendar';
import { seedCountries } from './countries';
import { seedPositions } from './positions';

export async function seedSelectedDatabase(
  prisma: PrismaClient,
  packages: ReadonlyArray<{ id: string }>,
): Promise<void> {
  await seedCountries(prisma);
  await seedCalendar(prisma);
  await seedPositions(prisma);
  if (packages.some((entry) => entry.id === 'equipment')) {
    const { seedMaintenanceTypes } = await import('./maintenance-types.js');
    await seedMaintenanceTypes(prisma);
  }
}
