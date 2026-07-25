import { PrismaPg } from '@prisma/adapter-pg';
import { loadRootConfig } from '../config/root-environment';

export const createPrismaClientOptions = () => {
  const config = loadRootConfig();

  return {
    adapter: new PrismaPg({
      connectionString: config.database.url,
    }),
  };
};
