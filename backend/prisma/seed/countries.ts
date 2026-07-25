import { PrismaClient } from "@prisma/client";
import { countries } from "./countries.data";

export async function seedCountries(
  prisma: PrismaClient,
): Promise<void> {
  await prisma.$transaction(
    countries.map((country) =>
      prisma.country.upsert({
        where: {
          iso: country.iso,
        },
        update: {
          name: country.name,
        },
        create: country,
      }),
    ),
  );
}