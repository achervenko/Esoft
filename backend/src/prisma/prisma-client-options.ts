import { PrismaPg } from '@prisma/adapter-pg';
import { loadRootDatabaseUrl } from '../config/root-environment';

export const createPrismaClientOptions = () => {
  const connectionString = loadRootDatabaseUrl();

  return {
    adapter: new PrismaPg({
      connectionString,
    }),
  };
};
