async function runSeed() {
  const prisma = new PrismaClient(createPrismaClientOptions());
  let seedError: unknown = null;

  try {
    await seedCountries(prisma);
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