import { createRequire } from 'node:module';

import { failure, success } from '../result.mjs';
import { formatError } from '../security/redaction.mjs';

const configCore = createRequire(import.meta.url)('../../config/config-core.cjs');

export function loadValidatedConfig({
  applyToProcessEnv = false,
  overrideProcessEnv = true,
  projectRoot,
} = {}) {
  try {
    const loadedEnvironment = configCore.loadEnvironment({
      applyToProcessEnv: false,
      overrideProcessEnv,
      projectRoot,
    });
    const validation = configCore.validateEnvironment(loadedEnvironment.env);

    if (!validation.valid) {
      return failure('CONFIG_INVALID', 'Configuration is invalid', {
        errors: validation.errors,
        envPath: loadedEnvironment.envPath,
        projectRoot: loadedEnvironment.projectRoot,
        warnings: validation.warnings,
      });
    }

    if (applyToProcessEnv) {
      configCore.applyEnvironment(loadedEnvironment.env, {
        override: overrideProcessEnv,
      });
    }

    return success('CONFIG_VALID', 'Configuration is valid', {
      config: configCore.buildConfig(loadedEnvironment.env),
      envPath: loadedEnvironment.envPath,
      projectRoot: loadedEnvironment.projectRoot,
      warnings: validation.warnings,
    });
  } catch (error) {
    if (error?.code === 'ESOFT_ENV_NOT_FOUND') {
      return failure('CONFIG_ENV_FILE_MISSING', 'Root .env file was not found', {
        envPath: error.envPath,
        projectRoot: error.projectRoot ?? projectRoot ?? null,
      });
    }

    return failure('CONFIG_LOAD_FAILED', 'Unable to load configuration', {
      error: formatError(error),
    });
  }
}
