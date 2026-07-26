import assert from 'node:assert/strict';
import { inspect } from 'node:util';

export const SECRET_MARKERS = Object.freeze([
  'TEST_DATABASE_SECRET_DO_NOT_PRINT',
  'TEST_MINIO_SECRET_DO_NOT_PRINT',
  'TEST_APPLICATION_SECRET_DO_NOT_PRINT',
]);

export function assertOperationResult(result, { ok } = {}) {
  assert.equal(typeof result, 'object');
  assert.notEqual(result, null);
  assert.equal(typeof result.ok, 'boolean');
  assert.equal(typeof result.code, 'string');
  assert.notEqual(result.code, '');
  assert.equal(typeof result.message, 'string');
  assert.notEqual(result.message, '');

  if (ok !== undefined) {
    assert.equal(result.ok, ok, 'OperationResult ok mismatch');
  }

  if ('details' in result) {
    assert.equal(typeof result.details, 'object');
    assert.notEqual(result.details, null);
    assert.equal(Array.isArray(result.details), false);
  }

  assertNoSecretLeak(result);
}

export function assertNoSecretLeak(value) {
  const serialized = serialize(value);

  for (const marker of SECRET_MARKERS) {
    assert.equal(
      serialized.includes(marker),
      false,
      `secret marker leaked: ${marker}`,
    );
  }
}

function serialize(value) {
  return inspect(value, {
    customInspect: false,
    depth: null,
  });
}
