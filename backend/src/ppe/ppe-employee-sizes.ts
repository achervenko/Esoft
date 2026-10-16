import type { Prisma } from '@prisma/client';

export const employeeSizesSelect = {
  clothingSize: true,
  clothingHeight: true,
  shoeSize: true,
  gloveSize: true,
  headwearSize: true,
} satisfies Prisma.PpeEmployeeSizesSelect;

export type EmployeeSizeValues = Prisma.PpeEmployeeSizesGetPayload<{
  select: typeof employeeSizesSelect;
}>;
