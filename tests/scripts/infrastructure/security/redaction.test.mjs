import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatError,
  redactSecrets,
  redactSensitiveText,
} from '../../../../scripts/infrastructure/security/redaction.mjs';
import {
  assertNoSecretLeak,
  SECRET_MARKERS,
} from '../../helpers/operation-result.mjs';

test('redactSensitiveText redacts secret names and assignment values', () => {
  const result = redactSensitiveText(
    `DATABASE_PASSWORD=hunter2 token ${SECRET_MARKERS[0]}`,
  );

  assert.equal(result.includes('hunter2'), false);
  assert.equal(result.includes(SECRET_MARKERS[0]), false);
  assert.equal(result, '[redacted]=[redacted] [redacted] [redacted]');
});

test('redactSensitiveText redacts lowercase and mixed-case secret assignments', () => {
  const result = redactSensitiveText(
    'password=hunter2 database_url=postgresql://user:pass@host/db access_token=abc123 ApiSecret=value MINIO_ACCESS_KEY=minio-access',
  );

  assert.equal(result.includes('hunter2'), false);
  assert.equal(result.includes('postgresql://user:pass@host/db'), false);
  assert.equal(result.includes('abc123'), false);
  assert.equal(result.includes('value'), false);
  assert.equal(result.includes('minio-access'), false);
  assert.equal(
    result,
    '[redacted]=[redacted] [redacted]=[redacted] [redacted]=[redacted] [redacted]=[redacted] [redacted]=[redacted]',
  );
});

test('redactSensitiveText redacts colon-separated secret assignments', () => {
  const result = redactSensitiveText(
    'authorization: Bearer-token secret: actual-secret',
  );

  assert.equal(result.includes('Bearer-token'), false);
  assert.equal(result.includes('actual-secret'), false);
  assert.equal(result, '[redacted]=[redacted] [redacted]=[redacted]');
});

test('redactSensitiveText redacts quoted assignment values with spaces', () => {
  const result = redactSensitiveText(
    'PASSWORD="very secret value" API_TOKEN=\'another secret value\'',
  );

  assert.equal(result.includes('very secret value'), false);
  assert.equal(result.includes('another secret value'), false);
  assert.equal(result, '[redacted]=[redacted] [redacted]=[redacted]');
});

test('redactSensitiveText redacts credentials inside connection URLs', () => {
  const result = redactSensitiveText(
    'postgresql://esoft:database-password@127.0.0.1:5432/esoft',
  );

  assert.equal(result.includes('database-password'), false);
  assert.equal(
    result,
    'postgresql://esoft:[redacted]@127.0.0.1:5432/esoft',
  );
});

test('redactSecrets redacts object keys and nested values', () => {
  const result = redactSecrets({
    [SECRET_MARKERS[0]]: true,
    nested: {
      value: `DATABASE_TOKEN=token-value ${SECRET_MARKERS[1]}`,
    },
  });

  assertNoSecretLeak(result);
  assert.deepEqual(result, {
    '[redacted]': true,
    nested: {
      value: '[redacted]=[redacted] [redacted]',
    },
  });
});

test('redactSecrets handles cyclic objects', () => {
  const value = {
    password: 'DATABASE_PASSWORD=hunter2',
  };
  value.self = value;

  const result = redactSecrets(value);

  assert.equal(result['[redacted]'], '[redacted]=[redacted]');
  assert.equal(result.self, '[Circular]');
  assertNoSecretLeak(result);
});

test('redactSecrets handles cyclic arrays', () => {
  const value = [];
  value.push(value);

  assert.deepEqual(redactSecrets(value), ['[Circular]']);
});

test('redactSecrets preserves repeated non-cyclic objects as redacted copies', () => {
  const shared = {
    value: 'safe',
  };

  const result = redactSecrets({
    first: shared,
    second: shared,
  });

  assert.deepEqual(result, {
    first: {
      value: 'safe',
    },
    second: {
      value: 'safe',
    },
  });
  assert.notEqual(result.first, shared);
  assert.notEqual(result.second, shared);
  assert.notEqual(result.first, result.second);
});

test('redactSecrets does not mutate the source value', () => {
  const source = {
    nested: {
      value: 'DATABASE_TOKEN=token-value',
    },
  };

  const result = redactSecrets(source);

  assert.notEqual(result, source);
  assert.notEqual(result.nested, source.nested);
  assert.equal(source.nested.value, 'DATABASE_TOKEN=token-value');
  assert.equal(result.nested.value, '[redacted]=[redacted]');
});

test('formatError redacts unexpected error messages', () => {
  const result = formatError(
    new Error(`connection failed DATABASE_PASSWORD=hunter2 ${SECRET_MARKERS[2]}`),
  );

  assert.equal(result.includes('hunter2'), false);
  assert.equal(result.includes(SECRET_MARKERS[2]), false);
});

test('formatError handles and redacts non-Error values', () => {
  assert.equal(formatError('DATABASE_PASSWORD=hunter2'), '[redacted]=[redacted]');
});

test('formatError handles values with throwing string conversion', () => {
  const result = formatError({
    toString() {
      throw new Error('string conversion failed');
    },
  });

  assert.equal(result, '[unformattable error]');
});

test('formatError handles Error objects with throwing message access', () => {
  class BrokenError extends Error {
    get message() {
      throw new Error('message access failed');
    }
  }

  assert.equal(formatError(new BrokenError()), '[unformattable error]');
});
