import { loadConfig } from '../config/load-config.mjs';
import { validateConfig } from '../config/validate-config.mjs';
import { failure, success } from '../infrastructure/result.mjs';
import { formatError } from '../infrastructure/security/redaction.mjs';

export async function loadProductionConfig({
  applyToProcessEnv = true,
  loadConfig: loadConfigImpl = loadConfig,
  overrideProcessEnv = true,
  projectRoot,
  validateConfig: validateConfigImpl = validateConfig,
}) {
  const validation = validateConfigImpl({
    applyToProcessEnv,
    overrideProcessEnv,
    projectRoot,
  });

  if (!validation.valid) {
    return {
      result: failure(
        'PROD_CONFIG_INVALID',
        'Production configuration is invalid',
        {
          errors: validation.errors,
          envPath: validation.envPath,
          warnings: validation.warnings,
        },
      ),
    };
  }

  let loaded;

  try {
    loaded = loadConfigImpl({
      applyToProcessEnv,
      overrideProcessEnv,
      projectRoot,
    });
  } catch (error) {
    return {
      result: failure('PROD_CONFIG_LOAD_FAILED', 'Unable to load configuration', {
        error: formatError(error),
      }),
    };
  }

  if (loaded.config.nodeEnv !== 'production') {
    return {
      result: failure(
        'PROD_MODE_REQUIRED',
        'Production mode requires NODE_ENV=production.',
        {
          envPath: loaded.envPath,
          nodeEnv: loaded.config.nodeEnv || '[empty]',
        },
      ),
    };
  }

  return {
    config: loaded.config,
    env: loaded.env,
    projectRoot: loaded.projectRoot,
    result: success('PROD_CONFIG_OK', 'Production configuration is valid', {
      envPath: loaded.envPath,
      warnings: validation.warnings,
    }),
  };
}
