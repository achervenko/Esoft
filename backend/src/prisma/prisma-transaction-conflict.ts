import { Prisma } from '@prisma/client';

export function isPrismaTransactionConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === 'P2034') return true;
  if (error.code !== 'P2010') return false;
  const adapterError = error.meta?.driverAdapterError as
    { cause?: { originalCode?: unknown } } | undefined;
  return [error.meta?.code, adapterError?.cause?.originalCode].some(
    (code) => code === '40001' || code === '40P01',
  );
}
