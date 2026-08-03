import { failure } from '../infrastructure/result.mjs';
import { loadProductionConfig } from './setup-prod.config.mjs';

export async function loadProductionBackupConfig(params) {
  const loaded = await loadProductionConfig({
    ...params,
    applyToProcessEnv: false,
  });

  if (!loaded.result.ok) {
    return {
      ...loaded,
      result: failure('BACKUP_CONFIG_INVALID', loaded.result.message, {
        causeCode: loaded.result.code,
        ...(loaded.result.details ?? {}),
      }),
    };
  }

  if (!loaded.config.backup.dir) {
    return {
      ...loaded,
      result: failure(
        'BACKUP_CONFIG_INVALID',
        'BACKUP_DIR is required for production backup.',
        {
          variable: 'BACKUP_DIR',
        },
      ),
    };
  }

  return loaded;
}
