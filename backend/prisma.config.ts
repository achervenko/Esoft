import { resolve } from 'node:path';

import { defineConfig } from 'prisma/config';

import { loadValidatedConfig } from '../scripts/infrastructure/config/validated-config.mjs';

const projectRoot = resolve(__dirname, '..');

if (process.argv.includes('migrate') || (process.argv.includes('db') && process.argv.includes('push'))) {
  throw new Error('Use npm run db:migrate:deploy or db:migrate:status from the project root. Direct Prisma migration commands bypass database package selection and history checks.');
}

const result = loadValidatedConfig({
  applyToProcessEnv: true,
  overrideProcessEnv: true,
  projectRoot,
  profile: 'database',
});

if (!result.ok) {
  throw new Error(result.message);
}

export default defineConfig({
  schema: 'prisma/schema',

  migrations: {
    seed: 'tsx prisma/seed.ts',
  },

  datasource: {
    url: result.details.config.database.url,
  },
});
