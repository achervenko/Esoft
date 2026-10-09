const {
  toInteger,
  validateApiUrl,
  validateBoolean,
  validateDatabaseUrlPassword,
  validateDistinctPorts,
  validateExistingFile,
  validateExistingOrCreatableDirectory,
  validateHttpOrigin,
  validateHttpUrl,
  validateListenerHost,
  validateNodeEnv,
  validateNotPlaceholder,
  validatePort,
  validatePostgresUrl,
} = require('./validators.cjs');

const { requiredVariables, getValidationProfile } = require('./validation-profiles.cjs');

const secretVariables = new Set([
  'DATABASE_URL',
  'BETTER_AUTH_SECRET',
  'MINIO_ROOT_PASSWORD',
  'MINIO_ACCESS_KEY',
  'MINIO_SECRET_KEY',
]);

const placeholderValues = new Map([
  [
    'BETTER_AUTH_SECRET',
    ['change_me_to_a_long_random_secret', 'replace-with-generated-secret'],
  ],
  ['MINIO_ACCESS_KEY', ['change_me']],
  ['MINIO_ROOT_PASSWORD', ['change_me', 'replace-with-minio-password']],
  ['MINIO_SECRET_KEY', ['change_me', 'replace-with-minio-password']],
]);

const booleanValues = new Set(['true', 'false']);
const nodeEnvValues = new Set(['development', 'test', 'production']);

function buildConfig(source, { profile = 'local' } = {}) {
  const selection = getValidationProfile(profile);
  if (!selection) throw new Error('Unknown configuration profile');
  const env = Object.fromEntries(Object.entries(source).filter(([name]) => selection.variables.has(name) || name === 'MINIO_REGION'));
  const minioUseSsl = env.MINIO_USE_SSL === 'true';
  const minioProtocol = minioUseSsl ? 'https' : 'http';

  return {
    nodeEnv: env.NODE_ENV,
    backend: {
      internalUrl: internalHttpUrl(env.BACKEND_HOST, env.BACKEND_PORT),
      host: env.BACKEND_HOST,
      port: toInteger(env.BACKEND_PORT),
      url: env.BACKEND_URL,
    },
    frontend: {
      internalUrl: internalHttpUrl(env.FRONTEND_HOST, env.FRONTEND_PORT),
      host: env.FRONTEND_HOST,
      port: hasValue(env.FRONTEND_PORT) ? toInteger(env.FRONTEND_PORT) : undefined,
      url: env.FRONTEND_URL,
      apiUrl: env.VITE_API_URL,
    },
    database: {
      url: env.DATABASE_URL,
    },
    auth: {
      secret: env.BETTER_AUTH_SECRET,
      url: env.BETTER_AUTH_URL,
    },
    minio: {
      accessKey: env.MINIO_ACCESS_KEY,
      bucket: env.MINIO_BUCKET,
      consolePort: hasValue(env.MINIO_CONSOLE_PORT) ? toInteger(env.MINIO_CONSOLE_PORT) : undefined,
      consoleUrl: hasValue(env.MINIO_CONSOLE_PORT) ? `${minioProtocol}://${env.MINIO_HOST}:${env.MINIO_CONSOLE_PORT}` : undefined,
      dataDir: env.MINIO_DATA_DIR,
      endpoint: hasValue(env.MINIO_HOST) && hasValue(env.MINIO_PORT) ? `${minioProtocol}://${env.MINIO_HOST}:${env.MINIO_PORT}` : undefined,
      executable: env.MINIO_EXECUTABLE,
      host: env.MINIO_HOST,
      port: hasValue(env.MINIO_PORT) ? toInteger(env.MINIO_PORT) : undefined,
      region: env.MINIO_REGION?.trim() || 'us-east-1',
      rootPassword: env.MINIO_ROOT_PASSWORD,
      rootUser: env.MINIO_ROOT_USER,
      secretKey: env.MINIO_SECRET_KEY,
      useSsl: minioUseSsl,
    },
    backup: {
      dir: env.BACKUP_DIR?.trim() || null,
      pgDumpPath: env.PG_DUMP_PATH?.trim() || null,
      pgRestorePath: env.PG_RESTORE_PATH?.trim() || null,
    },
  };
}

function internalHttpUrl(host, port) {
  if (!hasValue(host) || !hasValue(port)) return undefined;
  const connectHost = host === '0.0.0.0' ? '127.0.0.1' : host === '::' ? '::1' : host;
  const urlHost = connectHost.includes(':') && !connectHost.startsWith('[')
    ? `[${connectHost}]`
    : connectHost;
  return `http://${urlHost}:${port}`;
}

function validateEnvironment(source, { profile = 'local' } = {}) {
  const selection = getValidationProfile(profile);
  if (!selection) return { valid: false, errors: [{ variable: 'CONFIG_PROFILE', message: 'Неизвестный профиль конфигурации.' }], warnings: [] };
  const env = Object.fromEntries(Object.entries(source).filter(([name]) => selection.variables.has(name)));
  const errors = [];
  const warnings = [];

  for (const variable of selection.required) {
    if (!hasValue(env[variable])) {
      errors.push({
        variable,
        message: 'Обязательная переменная не заполнена.',
      });
    }
  }

  validateListenerHost(env, 'BACKEND_HOST', errors);
  validateListenerHost(env, 'FRONTEND_HOST', errors);
  validatePort(env, 'BACKEND_PORT', errors);
  validatePort(env, 'FRONTEND_PORT', errors);
  validatePort(env, 'MINIO_PORT', errors);
  validatePort(env, 'MINIO_CONSOLE_PORT', errors);

  validateHttpOrigin(env, 'BACKEND_URL', errors);
  validateHttpOrigin(env, 'FRONTEND_URL', errors);
  validateHttpUrl(env, 'VITE_API_URL', errors);
  validateHttpOrigin(env, 'BETTER_AUTH_URL', errors);
  validatePostgresUrl(env, 'DATABASE_URL', errors);
  validateDatabaseUrlPassword(env, errors);
  validateBoolean(env, 'MINIO_USE_SSL', errors, booleanValues);
  validateNodeEnv(env, errors, nodeEnvValues);
  validateExistingFile(env, 'MINIO_EXECUTABLE', errors);
  validateExistingOrCreatableDirectory(env, 'MINIO_DATA_DIR', errors);
  validateExistingOrCreatableDirectory(env, 'BACKUP_DIR', errors);
  validateExistingFile(env, 'PG_DUMP_PATH', errors);
  validateExistingFile(env, 'PG_RESTORE_PATH', errors);

  validateNotPlaceholder(env, errors, placeholderValues);
  if (profile === 'local' || profile === 'frontend') validateDistinctPorts(env, errors);
  validateApiUrl(env, warnings);

  return {
    errors,
    valid: errors.length === 0,
    warnings,
  };
}

function hasValue(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

module.exports = {
  buildConfig,
  requiredVariables,
  secretVariables,
  validateEnvironment,
};
