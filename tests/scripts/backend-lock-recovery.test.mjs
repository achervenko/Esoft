import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import locks from '../../scripts/infrastructure/operations/installation-lock.cjs';

for (const operation of ['backend', 'backup', 'restore']) {
  test(`backend recovery protects ${operation} unless its backend owner is dead`, () => {
    const root = mkdtempSync(join(tmpdir(), 'esoft-lock-recovery-'));
    const file = join(root, '.local', '.production-operation.lock');
    mkdirSync(join(root, '.local'));
    writeFileSync(file, JSON.stringify({ operation, pid: 987654, token: 'old' }));
    try {
      assert.throws(() => locks.acquireInstallationLock({ projectRoot: root, operation: 'backend', recoverBackend: true, probeProcess() {} }));
      assert.equal(JSON.parse(readFileSync(file)).token, 'old');
      const acquire = () => locks.acquireInstallationLock({ projectRoot: root, operation: 'backend', recoverBackend: true,
        probeProcess() { throw Object.assign(new Error(), { code: 'ESRCH' }); } });
      if (operation === 'backend') acquire().release();
      else assert.throws(acquire);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
}
