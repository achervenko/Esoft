const {
  toInteger,
  validateApiUrl,
  validateBoolean,
  validateDatabaseUrlPassword,
  validateDistinctPorts,
  validateExistingFile,
  validateExistingOrCreatableDirectory,
  validateExpectedUrl,
  validateHttpOrigin,
  validateHttpUrl,
  validateNodeEnv,
  validateNotPlaceholder,
  validatePort,
  validatePostgresUrl,
} = require('./validators.cjs');

const requiredVariables = [
  'NODE_ENV',
  'BACKEND_HOST',
  'BACKEND_PORT',
  'BACKEND_URL',
  'FRONTEND_HOST',
  'FRONTEND_PORT',
  'FRONTEND_URL',
  'VITE_API_URL',
  'DATABASE_URL',
  'BETTER_AUTH_SECRET',
  'BETTER_AUTH_URL',
  'MINIO_HOST',
  'MINIO_PORT',
  'MINIO_CONSOLE_PORT',
  'MINIO_USE_SSL',
  'MINIO_ROOT_USER',
  'MINIO_ROOT_PASSWORD',
  'MINIO_ACCESS_KEY',
  'MINIO_SECRET_KEY',
  'MINIO_BUCKET',
  'MINIO_EXECUTABLE',
  'MINIO_DATA_DIR',
];

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

function buildConfig(env) {
  const minioUseSsl = env.MINIO_USE_SSL === 'true';
  const minioProtocol = minioUseSsl ? 'https' : 'http';

  return {
    nodeEnv: env.NODE_ENV,
    backend: {
      host: env.BACKEND_HOST,
      port: toInteger(env.BACKEND_PORT),
      url: env.BACKEND_URL,
    },
    frontend: {
      host: env.FRONTEND_HOST,
      port: toInteger(env.FRONTEND_PORT),
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
      consolePort: toInteger(env.MINIO_CONSOLE_PORT),
      consoleUrl: `${minioProtocol}://${env.MINIO_HOST}:${env.MINIO_CONSOLE_PORT}`,
      dataDir: env.MINIO_DATA_DIR,
      endpoint: `${minioProtocol}://${env.MINIO_HOST}:${env.MINIO_PORT}`,
      executable: env.MINIO_EXECUTABLE,
      host: env.MINIO_HOST,
      port: toInteger(env.MINIO_PORT),
      region: env.MINIO_REGION?.trim() || 'us-east-1',
      rootPassword: env.MINIO_ROOT_PASSWORD,
      rootUser: env.MINIO_ROOT_USER,
      secretKey: env.MINIO_SECRET_KEY,
      useSsl: minioUseSsl,
    },
  };
}

function validateEnvironment(env) {
  const errors = [];
  const warnings = [];

  for (const variable of requiredVariables) {
    if (!hasValue(env[variable])) {
      errors.push({
        variable,
        message: 'Обязательная переменная не заполнена.',
      });
    }
  }

  validatePort(env, 'BACKEND_PORT', errors);
  validatePort(env, 'FRONTEND_PORT', errors);
  validatePort(env, 'MINIO_PORT', errors);
  validatePort(env, 'MINIO_CONSOLE_PORT', errors);

  validateHttpUrl(env, 'BACKEND_URL', errors);
  validateHttpOrigin(env, 'FRONTEND_URL', errors);
  validateHttpUrl(env, 'VITE_API_URL', errors);
  validateHttpOrigin(env, 'BETTER_AUTH_URL', errors);
  validatePostgresUrl(env, 'DATABASE_URL', errors);
  validateDatabaseUrlPassword(env, errors);
  validateBoolean(env, 'MINIO_USE_SSL', errors, booleanValues);
  validateNodeEnv(env, errors, nodeEnvValues);
  validateExistingFile(env, 'MINIO_EXECUTABLE', errors);
  validateExistingOrCreatableDirectory(env, 'MINIO_DATA_DIR', errors);

  validateNotPlaceholder(env, errors, placeholderValues);
  validateDistinctPorts(env, errors);
  validateExpectedUrl(env, 'BACKEND_URL', 'BACKEND_HOST', 'BACKEND_PORT', errors);
  validateExpectedUrl(env, 'FRONTEND_URL', 'FRONTEND_HOST', 'FRONTEND_PORT', errors);
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
