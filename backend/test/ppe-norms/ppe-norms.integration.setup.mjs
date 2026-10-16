import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { after } from 'node:test';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import packageTools from '../../../scripts/database/packages.cjs';

import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { loadValidatedConfig } from '../../../scripts/infrastructure/config/validated-config.mjs';

const require = createRequire(import.meta.url);
const { PpeNormsService } = require('../../dist/src/ppe/ppe-norms.service.js');
const { PpeAuditService } = require('../../dist/src/ppe/ppe-audit.service.js');
const {
  AuditLogService,
} = require('../../dist/src/audit/audit-log.service.js');
const {
  getBusinessTodayDate,
} = require('../../dist/src/application/business-date.js');

const {
  PpeNormsGuardsService,
} = require('../../dist/src/ppe/ppe-norms-guards.service.js');
const {
  PpeNormsAuditService,
} = require('../../dist/src/ppe/ppe-norms-audit.service.js');

const {
  PpeNormsFutureService,
} = require('../../dist/src/ppe/ppe-norms-future.service.js');
const {
  PpeNormsPersistenceService,
} = require('../../dist/src/ppe/ppe-norms-persistence.service.js');

function createNormsService(client, audit) {
  const guards = new PpeNormsGuardsService();
  const normAudit = new PpeNormsAuditService(audit);
  const persistence = new PpeNormsPersistenceService(client, normAudit);
  return new PpeNormsService(
    client,
    guards,
    normAudit,
    new PpeNormsFutureService(guards, normAudit, persistence),
    persistence,
  );
}

export async function createPpeNormTestEnvironment() {
  let databaseUrl = process.env.ESOFT_TEST_DATABASE_URL;
  if (!databaseUrl) {
    const configuration = loadValidatedConfig();
    if (!configuration.ok) throw new Error('Invalid local test configuration');
    databaseUrl = configuration.details.config.database.url;
  }
  const sourceUrl = new URL(databaseUrl);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(sourceUrl.hostname)) {
    throw new Error('PPE integration tests require local PostgreSQL');
  }
  const databaseName = `esoft_ppe_norm_test_${randomUUID().replaceAll('-', '')}`;
  const testUrl = new URL(sourceUrl);
  testUrl.pathname = `/${databaseName}`;
  const admin = new pg.Client({
    connectionString: sourceUrl.toString(),
    connectionTimeoutMillis: 3000,
  });
  let databaseCreated = false;
  let prisma;
  let service;
  const actor = 'ppe-norm-test-actor';
  const today = getBusinessTodayDate();
  function day(offset = 0) {
    return new Date(today.getTime() + offset * 86400000)
      .toISOString()
      .slice(0, 10);
  }
  function date(offset = 0) {
    return new Date(`${day(offset)}T00:00:00Z`);
  }

  async function initialize() {
    await admin.connect();
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    databaseCreated = true;
    const bootstrap = new pg.Client({ connectionString: testUrl.toString() });
    try {
      await bootstrap.connect();
      const { migrations } = packageTools.readPackageSet(
        resolve(import.meta.dirname, '../../..'),
      );
      for (const migration of migrations) {
        await bootstrap.query(migration.sql.toString('utf8'));
      }
    } finally {
      await bootstrap.end();
    }
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: testUrl.toString() }),
    });
    service = createNormsService(
      prisma,
      new PpeAuditService(new AuditLogService(prisma)),
    );
    await prisma.user.create({
      data: {
        id: actor,
        name: 'Norm tester',
        email: 'norm-test@example.invalid',
        role: 'ppe_specialist',
      },
    });
  }

  let cleanupPromise;
  function cleanup() {
    cleanupPromise ??= cleanupResources();
    return cleanupPromise;
  }

  async function cleanupResources() {
    try {
      await prisma?.$disconnect();
    } finally {
      try {
        if (databaseCreated) {
          assert.match(databaseName, /^esoft_ppe_norm_test_[a-f0-9]{32}$/);
          assert.notEqual(
            databaseName,
            decodeURIComponent(sourceUrl.pathname.slice(1)),
          );
          await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
        }
      } finally {
        await admin.end();
      }
    }
  }

  async function fixture() {
    const suffix = randomUUID();
    const position = await prisma.position.create({
      data: { name: `Position ${suffix}` },
    });
    const items = await Promise.all(
      [0, 1, 2].map((index) =>
        prisma.ppeItem.create({
          data: {
            article: `${suffix}-${index}`,
            name: `Item ${index}`,
            unit: 'пары',
            type: 'OTHER',
          },
        }),
      ),
    );
    const rows = items.slice(0, 2).map((item, index) => ({
      ppeItemId: item.id,
      quantity: index === 0 ? 1.125 : 12,
      periodCount: 1,
      periodUnit: index === 0 ? 'MONTH' : 'YEAR',
    }));
    return {
      position,
      items,
      rows,
      payload: {
        positionId: position.id,
        effectiveFrom: day(10),
        effectiveTo: null,
        items: rows,
      },
    };
  }
  function errorCode(code) {
    return (error) => {
      assert.equal(error.response?.code, code);
      return true;
    };
  }
  async function counts(positionId) {
    return {
      norms: await prisma.ppeNorm.count({ where: { positionId } }),
      items: await prisma.ppeNormItem.count({
        where: { norm: { positionId } },
      }),
    };
  }
  function injectingClient(intercept) {
    return {
      $transaction: (fn, options) =>
        prisma.$transaction((tx) => fn(intercept(tx)), options),
    };
  }

  try {
    await initialize();
    return {
      prisma,
      service,
      actor,
      day,
      date,
      fixture,
      counts,
      errorCode,
      injectingClient,
      createNormsService,
      PpeAuditService,
      AuditLogService,
      testUrl,
      admin,
      databaseName,
      cleanup,
    };
  } catch (error) {
    try {
      await cleanup();
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        'PPE test setup and cleanup failed',
      );
    }
    throw error;
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const groups = await Promise.all(
    [
      './ppe-norms-create.integration.test.mjs',
      './ppe-norms-read.integration.test.mjs',
      './ppe-norms.revisions.integration.test.mjs',
      './ppe-norms.future-update.integration.test.mjs',
      './ppe-norms.history-locks.integration.test.mjs',
      './ppe-norms-transactions.integration.test.mjs',
      './ppe-norms-concurrency.integration.test.mjs',
      './ppe-norms-lifecycle.integration.test.mjs',
    ].map((path) => import(path)),
  );
  const env = await createPpeNormTestEnvironment();
  after(() => env.cleanup());
  try {
    for (const { registerTests } of groups) {
      registerTests(env);
    }
  } catch (error) {
    await env.cleanup();
    throw error;
  }
}
