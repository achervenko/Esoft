import { PrismaClient } from '@prisma/client';

import { createPrismaClientOptions } from '../src/prisma/prisma-client-options';
import { seedCalendar } from './seed/calendar';
import { seedCountries } from './seed/countries';

const seeders = [seedCountries, seedCalendar];

async function runSeed() {
  const prisma = new PrismaClient(createPrismaClientOptions());
  let seedError: unknown = null;

  try {
    for (const seeder of seeders) {
      await seeder(prisma);
    }
  } catch (error) {
    seedError = error;
  }

  try {
    await prisma.$disconnect();
  } catch (disconnectError) {
    if (seedError) {
      throw new AggregateError(
        [seedError, disconnectError],
        'Seeding failed and Prisma could not disconnect',
      );
    }

    throw disconnectError;
  }

  if (seedError) {
    throw seedError;
  }
}

void runSeed().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
