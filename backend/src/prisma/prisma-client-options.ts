import { PrismaPg } from '@prisma/adapter-pg';

export const createPrismaClientOptions = () => {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  return {
    adapter: new PrismaPg({ connectionString }),
  };
};
