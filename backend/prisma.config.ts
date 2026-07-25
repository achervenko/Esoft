import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { defineConfig } from 'prisma/config';

const requireConfigModule = createRequire(__filename);

type ConfigCore = {
  loadConfig(options?: {
    applyToProcessEnv?: boolean;
    overrideProcessEnv?: boolean;
  }): {
    config: {
      database: {
        url: string;
      };
    };
  };
};

const configCore = requireConfigModule(
  resolve(__dirname, '../scripts/config/config-core.cjs'),
) as ConfigCore;

const { config } = configCore.loadConfig({
  applyToProcessEnv: true,
  overrideProcessEnv: true,
});

export default defineConfig({
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: config.database.url,
  },
});
