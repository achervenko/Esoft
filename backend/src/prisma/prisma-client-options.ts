import { PrismaPg } from '@prisma/adapter-pg';
import { DATABASE_DATE_TIME_ZONE } from '../application/business-date';
import { loadRootDatabaseUrl } from '../config/root-environment';

export const createPrismaClientOptions = () => {
  const connectionString = loadRootDatabaseUrl();

  return {
    adapter: new PrismaPg({
      connectionString,
      // PrismaPg requires UTC sessions for correct timestamptz reads and date parameters.
      options: `-c timezone=${DATABASE_DATE_TIME_ZONE}`,
    }),
  };
};
