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

const localMinioVariables = [
  'MINIO_CONSOLE_PORT',
  'MINIO_ROOT_USER',
  'MINIO_ROOT_PASSWORD',
  'MINIO_EXECUTABLE',
  'MINIO_DATA_DIR',
];
const frontendListenerVariables = ['FRONTEND_HOST', 'FRONTEND_PORT'];
const profiles = {
  'storage-operation': [
    'NODE_ENV',
    'DATABASE_URL',
    'MINIO_HOST',
    'MINIO_PORT',
    'MINIO_USE_SSL',
    'MINIO_ACCESS_KEY',
    'MINIO_SECRET_KEY',
    'MINIO_BUCKET',
  ],
  database: ['NODE_ENV', 'DATABASE_URL'],
  local: requiredVariables,
  backend: requiredVariables.filter(
    (name) =>
      ![
        ...localMinioVariables,
        ...frontendListenerVariables,
        'VITE_API_URL',
      ].includes(name),
  ),
  production: requiredVariables.filter(
    (name) =>
      ![...localMinioVariables, ...frontendListenerVariables].includes(name),
  ),
  frontend: [
    'NODE_ENV',
    'BACKEND_HOST',
    'BACKEND_PORT',
    'BACKEND_URL',
    'FRONTEND_HOST',
    'FRONTEND_PORT',
    'FRONTEND_URL',
    'VITE_API_URL',
  ],
};

function getValidationProfile(name) {
  if (!Object.hasOwn(profiles, name)) return null;
  const required = profiles[name];
  const optional =
    name === 'local' || name === 'production' || name === 'storage-operation'
      ? ['BACKUP_DIR', 'PG_DUMP_PATH', 'PG_RESTORE_PATH']
      : [];
  return { required, variables: new Set([...required, ...optional]) };
}

module.exports = { requiredVariables, getValidationProfile };
