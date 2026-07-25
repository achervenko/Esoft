import { PrismaClient } from "@prisma/client";
import { createPrismaClientOptions } from "../../src/prisma/prisma-client-options";
import { seedCountries } from "./countries";

export async function runSeed(): Promise<void> {
  const prisma = new PrismaClient(createPrismaClientOptions());

  try {
    await seedCountries(prisma);
  } finally {
    await prisma.$disconnect();
  }
}