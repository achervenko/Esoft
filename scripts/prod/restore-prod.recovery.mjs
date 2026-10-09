import { resolve } from 'node:path';

import { executeProductionBackup } from './backup-prod.mjs';
import { createDefaultProductionBackupOperations } from './backup-prod.operations.mjs';
import { createProductionBackupStageRunner } from './backup-prod.reporter.mjs';
import { failure, success } from '../infrastructure/result.mjs';

// Called inside restore's installation lease. Reuses the complete backup pipeline
// without trying to acquire the same exclusive lease a second time.
export async function createRestoreRecoveryBackup({
  config,
  projectRoot,
  context,
}) {
  const results = [];
  const reporter = {
    start() {},
    finish() {},
    success() {},
    failure() {},
    info() {},
  };
  const stage = createProductionBackupStageRunner({
    reporter,
    results,
    totalStages: 9,
  });
  const backupResult = await executeProductionBackup({
    config: {
      ...config,
      backup: {
        ...config.backup,
        dir: resolve(
          config.backup?.dir || resolve(projectRoot, '.local'),
          'restore-recovery',
        ),
      },
    },
    projectRoot,
    context,
    backupState: {},
    operations: createDefaultProductionBackupOperations(),
    stage,
    reporter,
    results,
  });
  if (!backupResult.ok)
    return failure(
      'RESTORE_RECOVERY_BACKUP_FAILED',
      'Unable to create verified pre-restore recovery backup; existing data has not been replaced',
      { backupResult },
    );
  return success(
    'RESTORE_RECOVERY_BACKUP_OK',
    'Verified pre-restore recovery backup created',
    {
      recoveryBackupPath: backupResult.details.backupPath,
    },
  );
}
