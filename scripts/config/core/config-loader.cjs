const { existsSync } = require('node:fs');
const { applyEnvironment, parseEnvFile } = require('./env-file.cjs');
const { findProjectRoot, getRootEnvPath } = require('./project-root.cjs');
const { buildConfig, validateEnvironment } = require('./config-schema.cjs');

function loadEnvironment(options = {}) {
  const projectRoot = options.projectRoot ?? findProjectRoot();
  const envPath = options.envPath ?? getRootEnvPath(projectRoot);
  const overrideProcessEnv = options.overrideProcessEnv ?? true;

  if (!existsSync(envPath)) {
    const error = new Error(
      `Корневой файл .env не найден. Создайте его из .env.example: ${envPath}`,
    );
    error.code = 'ESOFT_ENV_NOT_FOUND';
    error.envPath = envPath;
    error.projectRoot = projectRoot;
    throw error;
  }

  const fileEnvironment = parseEnvFile(envPath);

  const env = overrideProcessEnv
    ? {
        ...process.env,
        ...fileEnvironment,
      }
    : {
        ...fileEnvironment,
        ...process.env,
      };

  if (options.applyToProcessEnv) {
    applyEnvironment(fileEnvironment, {
      override: overrideProcessEnv,
    });
  }

  return {
    env,
    envPath,
    projectRoot,
  };
}

function loadConfig(options = {}) {
  const loadedEnvironment = loadEnvironment(options);
  const validation = validateEnvironment(loadedEnvironment.env);

  if (!validation.valid) {
    const error = new Error('Esoft configuration is invalid.');
    error.code = 'ESOFT_ENV_INVALID';
    error.envPath = loadedEnvironment.envPath;
    error.projectRoot = loadedEnvironment.projectRoot;
    error.validation = validation;
    throw error;
  }

  return {
    ...loadedEnvironment,
    config: buildConfig(loadedEnvironment.env),
  };
}

module.exports = {
  loadConfig,
  loadEnvironment,
};
