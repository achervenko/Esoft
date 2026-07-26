import assert from 'node:assert/strict';
import test from 'node:test';
import { inspect } from 'node:util';

import {
  assertNoSecretLeak,
  assertOperationResult,
  SECRET_MARKERS,
} from './operation-result.mjs';

test('assertOperationResult accepts a valid operation result', () => {
  const result = {
    ok: true,
    code: 'TEST_OK',
    message: 'Completed',
    details: {
      count: 1,
    },
  };

  assert.doesNotThrow(() => {
    assertOperationResult(result, { ok: true });
  });
});

test('assertOperationResult rejects an unexpected ok value', () => {
  const result = {
    ok: false,
    code: 'TEST_FAILED',
    message: 'Failed',
  };

  assert.throws(
    () => assertOperationResult(result, { ok: true }),
    /OperationResult ok mismatch/,
  );
});

test('assertOperationResult rejects malformed results', () => {
  assert.throws(() => assertOperationResult(null, { ok: true }));
  assert.throws(() => assertOperationResult({ ok: true }, { ok: true }));
});

test('assertOperationResult rejects secret markers in diagnostics', () => {
  const result = {
    ok: false,
    code: 'TEST_FAILED',
    message: SECRET_MARKERS[0],
  };

  assert.throws(
    () => assertOperationResult(result, { ok: false }),
    /secret marker leaked/,
  );
});

test('assertNoSecretLeak handles undefined and BigInt values', () => {
  assert.doesNotThrow(() => assertNoSecretLeak(undefined));
  assert.doesNotThrow(() => assertNoSecretLeak(123n));
});

test('assertNoSecretLeak handles cyclic objects', () => {
  const value = { name: 'cycle' };
  value.self = value;

  assert.doesNotThrow(() => assertNoSecretLeak(value));
});

test('assertNoSecretLeak detects secrets in nested errors', () => {
  const error = new Error('primary failure', {
    cause: new Error(SECRET_MARKERS[0]),
  });

  assert.throws(() => assertNoSecretLeak(error), /secret marker leaked/);
});

test('assertNoSecretLeak detects secrets in AggregateError errors', () => {
  const error = new AggregateError(
    [new Error(SECRET_MARKERS[1])],
    'combined failure',
  );

  assert.throws(() => assertNoSecretLeak(error), /secret marker leaked/);
});

test('assertNoSecretLeak ignores custom inspect hooks', () => {
  const value = {
    hidden: SECRET_MARKERS[2],
    [inspect.custom]() {
      return 'safe';
    },
  };

  assert.throws(() => assertNoSecretLeak(value), /secret marker leaked/);
});
