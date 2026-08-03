import { failure, success } from '../infrastructure/result.mjs';
import { loadProductionConfig } from './setup-prod.config.mjs';

export async function loadProductionRestoreConfig(options = {}) {
  const loaded = await loadProductionConfig(options);

  if (!loaded.result.ok) {
    return {
      ...loaded,
      result: failure(
        'RESTORE_CONFIG_INVALID',
        loaded.result.message,
        {
          causeCode: loaded.result.code,
          causeDetails: loaded.result.details,
        },
      ),
    };
  }

  return {
    ...loaded,
    result: success(
      'RESTORE_CONFIG_OK',
      'Production restore configuration is valid',
      loaded.result.details,
    ),
  };
}
