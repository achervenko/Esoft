import { createRequire } from 'node:module';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import packageTools from './packages.cjs';
import { runCommand } from '../infrastructure/commands/run-command.mjs';
import { loadValidatedConfig } from '../infrastructure/config/validated-config.mjs';
import { withProductionOperationLock } from '../prod/production-operation-lock.mjs';
import { failure, success } from '../infrastructure/result.mjs';
import { redactSensitiveText } from '../infrastructure/security/redaction.mjs';

const require = createRequire(import.meta.url);
const { Client } = require('pg');
const prismaCli = require.resolve('prisma/build/index.js');

export function validateHistory(rows, migrations) {
  const files = new Map(migrations.map((entry) => [entry.id, entry]));
  for (const row of rows) {
    if (row.rolled_back_at) continue;
    const file = files.get(row.migration_name);
    if (!file) throw new Error(`Applied migration package/file missing: ${row.migration_name}`);
    if (row.checksum !== file.sha256) throw new Error(`Applied migration checksum mismatch: ${row.migration_name}`);
    if (!row.finished_at) throw new Error(`Failed or incomplete migration: ${row.migration_name}; recover using Prisma migrate resolve after inspecting the database`);
  }
}

export async function runPackageMigrations({ projectRoot, databaseUrl, operation, output = console }) {
  if (!['status', 'deploy'].includes(operation)) throw new Error('Supported operations: status, deploy. Author reviewed SQL migrations in their owning package; migrate dev/db push against a partial database is unsupported.');
  const set = packageTools.readPackageSet(projectRoot);
  const url = new URL(databaseUrl);
  const schema = url.searchParams.get('schema') || 'public';
  if (schema !== 'public') throw new Error('Esoft database packages target the public schema');
  const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5000, query_timeout: 10000 });
  const local = resolve(projectRoot, '.local');
  let temp;
  try {
    await client.connect();
    const locale = await client.query("SELECT current_setting('server_encoding') = 'UTF8' AND lower('ЁЖИК АБВ') = 'ёжик абв' AS supported");
    if (!locale.rows[0].supported) throw new Error('Unsupported database encoding/locale: Esoft requires UTF8 and Cyrillic case folding (for example ICU ru-RU). No migrations were applied.');
    // Shared by every checkout using this database, across all packages.
    const lock = await client.query("SELECT pg_try_advisory_lock(hashtext('esoft-package-migrations'), hashtext(current_database())) AS locked");
    if (!lock.rows[0].locked) throw new Error('Another Esoft database migration operation is running');
    const historyExists = await client.query('SELECT to_regclass($1) AS name', [`"${schema.replaceAll('"', '""')}"._prisma_migrations`]);
    if (historyExists.rows[0].name) {
      const rows = await client.query(`SELECT migration_name,checksum,finished_at,rolled_back_at FROM "${schema.replaceAll('"', '""')}"._prisma_migrations`);
      validateHistory(rows.rows, set.migrations);
    }
    await mkdir(local, { recursive: true });
    temp = await mkdtemp(join(local, 'migration-set-'));
    const directory = join(temp, 'migrations');
    await mkdir(directory);
    await writeFile(join(directory, 'migration_lock.toml'), 'provider = "postgresql"\n');
    for (const migration of set.migrations) {
      await mkdir(join(directory, migration.id));
      await writeFile(join(directory, migration.id, 'migration.sql'), migration.sql);
    }
    // Secrets stay in process environment, never in the generated config or logs.
    const config = join(temp, 'prisma.config.ts');
    await writeFile(config, `export default { schema: ${JSON.stringify(resolve(projectRoot, 'backend/prisma/schema'))}, migrations: { path: './migrations' }, datasource: { url: process.env.ESOFT_MIGRATION_DATABASE_URL } };\n`);
    output.log(`Database packages: ${set.packages.map((entry) => entry.id).join(', ')}`);
    const result = await runCommand(process.execPath, [prismaCli, 'migrate', operation, '--config', config], {
      cwd: projectRoot, env: { ...process.env, ESOFT_MIGRATION_DATABASE_URL: databaseUrl }, timeoutMs: 110_000,
    });
    if (result.stdout) output.log(redactSensitiveText(result.stdout));
    if (result.stderr) output.log(redactSensitiveText(result.stderr));
    if (result.ok && operation === 'deploy') {
      const rows = await client.query(`SELECT migration_name,checksum,finished_at,rolled_back_at FROM "${schema.replaceAll('"', '""')}"._prisma_migrations`);
      validateHistory(rows.rows, set.migrations);
      const applied = new Set(rows.rows.filter((row) => row.finished_at && !row.rolled_back_at).map((row) => row.migration_name));
      if (set.migrations.some((entry) => !applied.has(entry.id))) throw new Error('Deployment ended with pending package migrations');
    }
    return result;
  } finally {
    try { await client.end(); }
    finally {
      if (temp) {
        if (dirname(resolve(temp)) !== local || !basename(temp).startsWith('migration-set-')) throw new Error('Unsafe migration workspace cleanup');
        await rm(temp, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
      }
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const projectRoot = resolve(import.meta.dirname, '../..');
    const loaded = loadValidatedConfig({ projectRoot, profile: 'database', applyToProcessEnv: true, overrideProcessEnv: true });
    if (!loaded.ok) throw new Error(loaded.message);
    const operation = process.argv[2];
    const run = async () => {
      const result = await runPackageMigrations({ projectRoot, databaseUrl: loaded.details.config.database.url, operation });
      process.exitCode = result.ok ? 0 : 1;
      return result.ok ? success('DATABASE_PACKAGES_OK', 'Database packages ready') : failure('DATABASE_PACKAGES_FAILED', 'Database package operation failed');
    };
    if (operation === 'deploy') {
      const result = await withProductionOperationLock({ projectRoot, operation: 'migrations', run });
      if (!result.ok) { console.error(result.message); process.exitCode = 1; }
    } else await run();
  } catch (error) {
    console.error(redactSensitiveText(error.message));
    process.exitCode = 1;
  }
}
