import { resolve } from 'node:path';

import { defineConfig } from 'prisma/config';

import { loadValidatedConfig } from '../scripts/infrastructure/config/validated-config.mjs';

const projectRoot = resolve(__dirname, '..');

const result = loadValidatedConfig({
  applyToProcessEnv: true,
  overrideProcessEnv: true,
  projectRoot,
});

if (!result.ok) {
  throw new Error(result.message);
}

export default defineConfig({
  schema: 'prisma/schema',

  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },

  datasource: {
    url: result.details.config.database.url,
  },
});