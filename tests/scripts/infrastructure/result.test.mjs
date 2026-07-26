import assert from 'node:assert/strict';
import test from 'node:test';

import {
  combineResults,
  failure,
  success,
} from '../../../scripts/infrastructure/result.mjs';
import {
  assertNoSecretLeak,
  assertOperationResult,
} from '../helpers/operation-result.mjs';

test('success returns an OperationResult', () => {
  const details = { value: 1 };
  const result = success('TEST_OK', 'Test completed', details);

  assertOperationResult(result, { ok: true });
  assert.equal(result.code, 'TEST_OK');
  assert.equal(result.message, 'Test completed');
  assert.deepEqual(result.details, details);
  assertNoSecretLeak(result);
});

test('failure returns an OperationResult', () => {
  const result = failure('TEST_FAILED', 'Test failed', { reason: 'expected' });

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'TEST_FAILED');
  assert.equal(result.message, 'Test failed');
  assert.deepEqual(result.details, { reason: 'expected' });
  assertNoSecretLeak(result);
});

test('combineResults snapshots the input array and its results', () => {
  const firstResult = {
    code: 'FIRST_OK',
    details: {
      diagnostics: {
        stderr: 'before',
      },
      warnings: ['first warning'],
    },
    message: 'First completed',
    ok: true,
  };
  const source = [firstResult];
  const result = combineResults(source);

  source.push(failure('SECOND_FAILED', 'Second failed'));
  firstResult.code = 'MUTATED';
  firstResult.details.diagnostics.stderr = 'after';
  firstResult.details.warnings.push('mutated warning');
  firstResult.message = 'Mutated';

  assertOperationResult(result, { ok: true });
  assert.equal(result.code, 'OPERATIONS_COMPLETED');
  assert.deepEqual(result.details.results, [
    {
      code: 'FIRST_OK',
      details: {
        diagnostics: {
          stderr: 'before',
        },
        warnings: ['first warning'],
      },
      message: 'First completed',
      ok: true,
    },
  ]);
});

test('combineResults snapshots __proto__ as a data property', () => {
  const details = JSON.parse('{"__proto__":{"polluted":true}}');
  const result = combineResults([success('OK', 'Done', details)]);
  const snapshot = result.details.results[0].details;

  assertOperationResult(result, { ok: true });
  assert.equal(Object.getPrototypeOf(snapshot), Object.prototype);
  assert.equal(Object.hasOwn(snapshot, '__proto__'), true);
  assert.deepEqual(snapshot.__proto__, {
    polluted: true,
  });
  assert.equal(snapshot.polluted, undefined);
});

test('combineResults snapshots cyclic details', () => {
  const details = {
    value: 'diagnostic',
  };
  details.self = details;

  const result = combineResults([success('OK', 'Done', details)]);
  const snapshot = result.details.results[0].details;

  assertOperationResult(result, { ok: true });
  assert.notEqual(snapshot, details);
  assert.equal(snapshot.value, 'diagnostic');
  assert.equal(snapshot.self, snapshot);
});

test('combineResults preserves shared references in snapshots', () => {
  const shared = {
    value: 1,
  };

  const result = combineResults([
    success('OK', 'Done', {
      first: shared,
      second: shared,
    }),
  ]);
  const snapshot = result.details.results[0].details;

  assertOperationResult(result, { ok: true });
  assert.equal(snapshot.first, snapshot.second);
  assert.notEqual(snapshot.first, shared);
});

test('combineResults uses custom success result metadata', () => {
  const result = combineResults(
    [success('FIRST_OK', 'First completed')],
    {
      successCode: 'GROUP_OK',
      successMessage: 'Group completed',
    },
  );

  assertOperationResult(result, { ok: true });
  assert.equal(result.code, 'GROUP_OK');
  assert.equal(result.message, 'Group completed');
});

test('combineResults reports failure when any result fails', () => {
  const result = combineResults(
    [
      success('FIRST_OK', 'First completed'),
      failure('SECOND_FAILED', 'Second failed'),
    ],
    {
      failureCode: 'GROUP_FAILED',
      failureMessage: 'Group failed',
      successCode: 'GROUP_OK',
      successMessage: 'Group completed',
    },
  );

  assertOperationResult(result, { ok: false });
  assert.equal(result.code, 'GROUP_FAILED');
  assert.equal(result.message, 'Group failed');
  assert.deepEqual(result.details.results, [
    {
      code: 'FIRST_OK',
      message: 'First completed',
      ok: true,
    },
    {
      code: 'SECOND_FAILED',
      message: 'Second failed',
      ok: false,
    },
  ]);
});

test('combineResults succeeds for an empty result list', () => {
  const result = combineResults([]);

  assertOperationResult(result, { ok: true });
  assert.equal(result.code, 'OPERATIONS_COMPLETED');
  assert.deepEqual(result.details.results, []);
});
