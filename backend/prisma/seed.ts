import { PrismaClient } from '@prisma/client';

import { createPrismaClientOptions } from '../src/prisma/prisma-client-options';
import { seedSelectedDatabase } from './seed/seed-selected';
import { loadRootDatabaseEnvironment } from '../src/config/root-environment';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

async function runSeed() {
  const { projectRoot } = loadRootDatabaseEnvironment();
  const packageTools = createRequire(__filename)(
    resolve(projectRoot, 'scripts/database/packages.cjs'),
  );
  const { packages } = packageTools.readPackageSet(projectRoot);
  const prisma = new PrismaClient(createPrismaClientOptions());
  let seedError: unknown = null;

  try {
    await seedSelectedDatabase(prisma, packages);
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
