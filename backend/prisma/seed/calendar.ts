import { PrismaClient } from '@prisma/client';
import { generateDefaultCalendar } from '../../src/calendar/calendar.generator';

export async function seedCalendar(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction((tx) => generateDefaultCalendar(tx));
}
