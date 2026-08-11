import assert from 'node:assert/strict';
import test from 'node:test';

import { checkRequiredApplicationData } from '../../../../scripts/infrastructure/application-data/required-data.mjs';
import {
  assertNoSecretLeak,
  assertOperationResult,
  SECRET_MARKERS,
} from '../../helpers/operation-result.mjs';

const config = {
  database: {
    url: 'postgresql://user:password@127.0.0.1:5432/esoft',
  },
};

test('checkRequiredApplicationData returns success for enough countries and required ISO codes', async () => {
  let constructorOptions = null;
  let ended = false;
  let queryArgs = null;
  class PgClient {
    constructor(options) {
      constructorOptions = options;
    }

    async connect() {}

    async query(sql, args) {
      queryArgs = args;
      assert.match(sql, /count\(DISTINCT iso\)/);
      return {
        rows: [
          {
            count: '250',
            required_count: '3',
          },
        ],
      };
    }

    async end() {
      ended = true;
    }
  }

  const result = await checkRequiredApplicationData({ config, PgClient });

  assertOperationResult(result, { ok: true });
  assert.equal(result.code, 'APPLICATION_DATA_OK');
  assert.deepEqual(constructorOptions, {
    connectionString: config.database.url,
    connectionTimeoutMillis: 3_000,
  });
  assert.deepEqual(queryArgs, [['LV', 'EE', 'LT']]);
  assert.equal(ended, true);
});

test('checkRequiredApplicationData reports missing data', async () => {
  class PgClient {
    async connect() {}

    async query() {
      return {
        rows: [
          {
            count: '1',
            required_count: '1',
          },
        ],
      };
    }

    async end() {}
  }

  const result = await checkRequiredApplicationData({ config, PgClient });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'APPLICATION_DATA_MISSING');
  assert.equal(result.details.minimumCountries, 200);
});

test('checkRequiredApplicationData reports missing required ISO codes', async () => {
  class PgClient {
    async connect() {}

    async query() {
      return {
        rows: [
          {
            count: '250',
            required_count: '2',
          },
        ],
      };
    }

    async end() {}
  }

  const result = await checkRequiredApplicationData({ config, PgClient });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'APPLICATION_DATA_MISSING');
  assert.equal(result.details.countries, 250);
  assert.equal(result.details.requiredCountriesFound, 2);
});

test('checkRequiredApplicationData closes client after query failure', async () => {
  let ended = false;
  class PgClient {
    async connect() {}

    async query() {
      throw new Error('query failed');
    }

    async end() {
      ended = true;
    }
  }

  const result = await checkRequiredApplicationData({ config, PgClient });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'APPLICATION_DATA_CHECK_FAILED');
  assert.equal(ended, true);
});

test('checkRequiredApplicationData reports client close failure after success and terminates transport', async () => {
  let destroyed = false;
  class PgClient {
    connection = {
      stream: {
        destroy() {
          destroyed = true;
        },
      },
    };

    async connect() {}

    async query() {
      return {
        rows: [
          {
            count: '250',
            required_count: '3',
          },
        ],
      };
    }

    async end() {
      throw new Error('close failed');
    }
  }

  const result = await checkRequiredApplicationData({ config, PgClient });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'APPLICATION_DATA_CHECK_FAILED');
  assert.deepEqual(result.details, {
    error: 'close failed',
  });
  assert.equal(destroyed, true);
});

test('checkRequiredApplicationData reports close and termination failures after success', async () => {
  class PgClient {
    async connect() {}

    async query() {
      return {
        rows: [
          {
            count: '250',
            required_count: '3',
          },
        ],
      };
    }

    async end() {
      throw new Error('close failed');
    }
  }

  const result = await checkRequiredApplicationData({ config, PgClient });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'APPLICATION_DATA_CHECK_FAILED');
  assert.deepEqual(result.details, {
    error: 'close failed',
    terminationError: 'PgClient transport cannot be forcibly terminated',
  });
});

test('checkRequiredApplicationData preserves primary and cleanup failures', async () => {
  class PgClient {
    async connect() {}

    async query() {
      throw new Error('query failed');
    }

    async end() {
      throw new Error('close failed');
    }
  }

  const result = await checkRequiredApplicationData({ config, PgClient });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'APPLICATION_DATA_CHECK_FAILED');
  assert.deepEqual(result.details, {
    cleanupError: 'close failed',
    error: 'query failed',
    terminationError: 'PgClient transport cannot be forcibly terminated',
  });
});

test('checkRequiredApplicationData redacts query failure diagnostics', async () => {
  class PgClient {
    async connect() {}

    async query() {
      throw new Error(`query failed DATABASE_URL=${SECRET_MARKERS[0]}`);
    }

    async end() {}
  }

  const result = await checkRequiredApplicationData({ config, PgClient });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'APPLICATION_DATA_CHECK_FAILED');
  assertNoSecretLeak(result);
});
