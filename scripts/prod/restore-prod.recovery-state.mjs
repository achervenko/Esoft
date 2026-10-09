import { randomUUID } from 'node:crypto';
import { open, rename, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';

export function recoveryStatePath(projectRoot) {
  return resolve(projectRoot, '.local', '.restore-recovery-required.json');
}

export async function writeRestoreRecoveryState({
  projectRoot,
  backupPath,
  recoveryBackupPath,
}) {
  const path = recoveryStatePath(projectRoot);
  const temporary = `${path}.${randomUUID()}.tmp`;
  const file = await open(temporary, 'wx', 0o600);
  try {
    await file.writeFile(
      JSON.stringify({
        backupPath,
        recoveryBackupPath,
        createdAt: new Date().toISOString(),
      }),
    );
    await file.sync();
  } finally {
    await file.close();
  }
  await rename(temporary, path);
}

export async function clearRestoreRecoveryState({ projectRoot }) {
  await unlink(recoveryStatePath(projectRoot));
}
