import assert from 'node:assert/strict';
import test from 'node:test';

import {
  restoreEnvironment,
  snapshotEnvironment,
  withEnvironment,
} from './environment.mjs';

test('restoreEnvironment restores added, changed and removed variables', () => {
  const addedKey = 'ESOFT_ENV_ADDED_TEST';
  const changedKey = 'ESOFT_ENV_CHANGED_TEST';
  const removedKey = 'ESOFT_ENV_REMOVED_TEST';
  const outerSnapshot = snapshotEnvironment();

  try {
    delete process.env[addedKey];
    process.env[changedKey] = 'original-changed';
    process.env[removedKey] = 'original-removed';

    const snapshot = snapshotEnvironment();

    process.env[addedKey] = 'added';
    process.env[changedKey] = 'modified';
    delete process.env[removedKey];

    restoreEnvironment(snapshot);

    assert.equal(process.env[addedKey], undefined);
    assert.equal(process.env[changedKey], 'original-changed');
    assert.equal(process.env[removedKey], 'original-removed');
  } finally {
    restoreEnvironment(outerSnapshot);
  }
});

test('restoreEnvironment validates snapshot shape', () => {
  assert.throws(
    () => restoreEnvironment(null),
    /snapshot must be an environment snapshot object/,
  );
  assert.throws(
    () => restoreEnvironment([]),
    /snapshot must be an environment snapshot object/,
  );
});

test('withEnvironment restores environment after callback', async () => {
  const key = 'ESOFT_WITH_ENVIRONMENT_TEST';
  const outerSnapshot = snapshotEnvironment();

  try {
    process.env[key] = 'original';

    const result = await withEnvironment(async () => {
      process.env[key] = 'temporary';
      return 123;
    });

    assert.equal(result, 123);
    assert.equal(process.env[key], 'original');
  } finally {
    restoreEnvironment(outerSnapshot);
  }
});

test('withEnvironment restores environment after callback failure', async () => {
  const key = 'ESOFT_WITH_ENVIRONMENT_FAILURE_TEST';
  const outerSnapshot = snapshotEnvironment();

  try {
    process.env[key] = 'original';

    await assert.rejects(
      () =>
        withEnvironment(async () => {
          process.env[key] = 'temporary';
          throw new Error('callback failed');
        }),
      /callback failed/,
    );

    assert.equal(process.env[key], 'original');
  } finally {
    restoreEnvironment(outerSnapshot);
  }
});
