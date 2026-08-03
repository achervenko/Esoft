import assert from 'node:assert/strict';
import { join } from 'node:path';
import test from 'node:test';

import {
  createBackupWorkspace,
  formatBackupTimestamp,
} from '../../../scripts/prod/backup-prod.filesystem.mjs';
import { loadAppVersion } from '../../../scripts/prod/backup-prod.manifest.mjs';
import { assertOperationResult } from '../helpers/operation-result.mjs';
import { createTemporaryProject } from '../helpers/temporary-project.mjs';

test('createBackupWorkspace cleans incomplete folder when storage directory creation fails', async () => {
  const project = await createTemporaryProject();
  const backupRoot = join(project.root, 'backups');
  const incompletePath = join(
    backupRoot,
    '.2026-08-03_09-30-00.incomplete',
  );
  const storagePath = join(incompletePath, 'storage');
  const calls = [];

  try {
    const result = await createBackupWorkspace({
      backupRoot,
      clock: () => new Date('2026-08-03T09:30:00.000Z'),
      filesystem: {
        mkdir: async (path) => {
          calls.push(['mkdir', path]);

          if (path === storagePath) {
            throw new Error('storage mkdir failed');
          }
        },
        rm: async (path, options) => {
          calls.push(['rm', path, options]);
        },
      },
    });

    assertOperationResult(result, { ok: false });
    assert.equal(result.code, 'BACKUP_DIRECTORY_FAILED');
    assert.deepEqual(calls.at(-1), [
      'rm',
      incompletePath,
      {
        force: true,
        recursive: true,
      },
    ]);
  } finally {
    await project.remove();
  }
});

test('createBackupWorkspace does not clean incomplete folder it did not create', async () => {
  const project = await createTemporaryProject();
  const backupRoot = join(project.root, 'backups');
  const incompletePath = join(
    backupRoot,
    '.2026-08-03_09-30-00.incomplete',
  );
  const calls = [];

  try {
    const result = await createBackupWorkspace({
      backupRoot,
      clock: () => new Date('2026-08-03T09:30:00.000Z'),
      filesystem: {
        mkdir: async (path) => {
          calls.push(['mkdir', path]);

          if (path === incompletePath) {
            throw new Error('already exists');
          }
        },
        rm: async (path, options) => {
          calls.push(['rm', path, options]);
        },
      },
    });

    assertOperationResult(result, { ok: false });
    assert.equal(result.code, 'BACKUP_DIRECTORY_FAILED');
    assert.equal(calls.some(([operation]) => operation === 'rm'), false);
  } finally {
    await project.remove();
  }
});

test('formatBackupTimestamp is Windows safe', () => {
  assert.equal(
    formatBackupTimestamp(new Date('2026-08-03T09:30:00.000Z')),
    '2026-08-03_09-30-00',
  );
  assert.equal(formatBackupTimestamp(new Date('2026-08-03T09:30:00.000Z')).includes(':'), false);
});

test('loadAppVersion trims package version and rejects blank values', async () => {
  const project = await createTemporaryProject({
    'blank/package.json': JSON.stringify({
      version: '   ',
    }),
    'trimmed/package.json': JSON.stringify({
      version: '  0.0.1-test  ',
    }),
  });

  try {
    const blankResult = await loadAppVersion({
      projectRoot: join(project.root, 'blank'),
    });
    assertOperationResult(blankResult, { ok: false });
    assert.equal(blankResult.code, 'BACKUP_APP_VERSION_UNAVAILABLE');

    const trimmedResult = await loadAppVersion({
      projectRoot: join(project.root, 'trimmed'),
    });
    assertOperationResult(trimmedResult, { ok: true });
    assert.equal(trimmedResult.details.appVersion, '0.0.1-test');
  } finally {
    await project.remove();
  }
});
