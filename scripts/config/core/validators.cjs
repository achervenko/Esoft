const { accessSync, constants, existsSync, statSync } = require('node:fs');
const { dirname, parse } = require('node:path');
const { isIP } = require('node:net');

function validateListenerHost(env, variable, errors) {
  const value = env[variable];
  if (!hasValue(value)) {
    return;
  }
  const isHostname = value.length <= 253 && value.split('.').every((label) =>
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label),
  );
  if (!isIP(value) && !isHostname) {
    errors.push({
      variable,
      message: 'Укажите IP-адрес или hostname без протокола, порта и пути.',
    });
  }
}

function validatePort(env, variable, errors) {
  if (!hasValue(env[variable])) {
    return;
  }

  const port = toInteger(env[variable]);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    errors.push({
      variable,
      message: 'Порт должен быть целым числом от 1 до 65535.',
    });
  }
}

function validateExistingFile(env, variable, errors) {
  if (!hasValue(env[variable])) {
    return;
  }

  try {
    const stats = statSync(env[variable]);

    if (!stats.isFile()) {
      errors.push({
        variable,
        message: 'Значение должно указывать на существующий файл.',
      });
      return;
    }

    const mode =
      process.platform === 'win32'
        ? constants.R_OK
        : constants.R_OK | constants.X_OK;

    accessSync(env[variable], mode);
  } catch (error) {
    errors.push({
      variable,
      message:
        error instanceof Error
          ? `Файл недоступен: ${error.message}`
          : 'Файл недоступен.',
    });
  }
}

function validateExistingOrCreatableDirectory(env, variable, errors) {
  if (!hasValue(env[variable])) {
    return;
  }

  if (existsSync(env[variable])) {
    try {
      const stats = statSync(env[variable]);

      if (!stats.isDirectory()) {
        errors.push({
          variable,
          message: 'Значение должно указывать на каталог.',
        });
        return;
      }

      accessSync(env[variable], constants.R_OK | constants.W_OK);
    } catch (error) {
      errors.push({
        variable,
        message:
          error instanceof Error
            ? `Каталог недоступен: ${error.message}`
            : 'Каталог недоступен.',
      });
    }

    return;
  }

  const parent = findExistingParentDirectory(env[variable]);

  if (!parent) {
    errors.push({
      variable,
      message: 'Не найден существующий родительский каталог.',
    });
    return;
  }

  try {
    accessSync(parent, constants.R_OK | constants.W_OK);
  } catch (error) {
    errors.push({
      variable,
      message:
        error instanceof Error
          ? `Каталог нельзя создать: ${error.message}`
          : 'Каталог нельзя создать.',
    });
  }
}

function validateBoolean(env, variable, errors, booleanValues) {
  if (!hasValue(env[variable])) {
    return;
  }

  if (!booleanValues.has(env[variable])) {
    errors.push({
      variable,
      message: 'Допустимы только значения true или false.',
    });
  }
}

function validateHttpUrl(env, variable, errors) {
  if (!hasValue(env[variable])) {
    return;
  }

  const url = parseUrl(env[variable]);

  if (!url || !['http:', 'https:'].includes(url.protocol)) {
    errors.push({
      variable,
      message: 'Значение должно быть корректным HTTP(S) URL.',
    });
  }
}

function validateHttpOrigin(env, variable, errors) {
  const value = env[variable];

  if (typeof value !== 'string' || value.trim().length === 0) {
    return;
  }

  try {
    const url = new URL(value);

    if (
      (url.protocol !== 'http:' && url.protocol !== 'https:') ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      url.username ||
      url.password
    ) {
      throw new Error();
    }
  } catch {
    errors.push({
      variable,
      message:
        'Должен быть указан HTTP(S) origin без пути, параметров запроса, фрагмента и учётных данных.',
    });
  }
}

function validatePostgresUrl(env, variable, errors) {
  if (!hasValue(env[variable])) {
    return;
  }

  const url = parseUrl(env[variable]);

  if (!url || !['postgres:', 'postgresql:'].includes(url.protocol)) {
    errors.push({
      variable,
      message: 'Значение должно быть корректным PostgreSQL URL.',
    });
    return;
  }

  if (!url.hostname) {
    errors.push({
      variable,
      message: 'PostgreSQL URL должен содержать hostname.',
    });
  }

  if (!url.username) {
    errors.push({
      variable,
      message: 'PostgreSQL URL должен содержать имя пользователя.',
    });
  }

  if (!url.pathname || url.pathname === '/') {
    errors.push({
      variable,
      message: 'PostgreSQL URL должен содержать имя базы данных.',
    });
  }
}

function validateDatabaseUrlPassword(env, errors) {
  if (!hasValue(env.DATABASE_URL)) {
    return;
  }

  const url = parseUrl(env.DATABASE_URL);

  if (!url) {
    return;
  }

  if (['change_me', 'replace-with-db-password'].includes(url.password)) {
    errors.push({
      variable: 'DATABASE_URL',
      message: 'Замените пароль-заглушку в строке подключения.',
    });
  }
}

function validateNodeEnv(env, errors, nodeEnvValues) {
  if (!hasValue(env.NODE_ENV)) {
    return;
  }

  if (!nodeEnvValues.has(env.NODE_ENV)) {
    errors.push({
      variable: 'NODE_ENV',
      message: 'Допустимы только development, test или production.',
    });
  }
}

function validateNotPlaceholder(env, errors, placeholderValues) {
  for (const [variable, placeholders] of placeholderValues) {
    if (!hasValue(env[variable])) {
      continue;
    }

    if (placeholders.includes(env[variable])) {
      errors.push({
        variable,
        message: 'Замените значение-заглушку на локальное рабочее значение.',
      });
    }
  }
}

function validateDistinctPorts(env, errors) {
  const ports = [
    ['BACKEND_PORT', env.BACKEND_PORT],
    ['FRONTEND_PORT', env.FRONTEND_PORT],
    ['MINIO_PORT', env.MINIO_PORT],
    ['MINIO_CONSOLE_PORT', env.MINIO_CONSOLE_PORT],
  ]
    .filter(([, value]) => hasValue(value))
    .map(([variable, value]) => [variable, toInteger(value)]);

  for (let index = 0; index < ports.length; index += 1) {
    const [variable, port] = ports[index];

    if (!Number.isInteger(port)) {
      continue;
    }

    const duplicate = ports
      .slice(index + 1)
      .find(([, nextPort]) => nextPort === port);

    if (duplicate) {
      errors.push({
        variable,
        message: `Порт конфликтует с ${duplicate[0]}.`,
      });
    }
  }
}

function validateApiUrl(env, warnings) {
  if (!hasValue(env.VITE_API_URL) || !hasValue(env.BACKEND_URL)) {
    return;
  }

  const apiUrl = parseUrl(env.VITE_API_URL);
  const backendUrl = parseUrl(env.BACKEND_URL);

  if (!apiUrl || !backendUrl) {
    return;
  }

  if (apiUrl.origin !== backendUrl.origin) {
    warnings.push({
      variable: 'VITE_API_URL',
      message:
        'Origin отличается от публичного BACKEND_URL. Проверьте, что это сделано намеренно.',
    });
  }
}

function hasValue(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function toInteger(value) {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) ? numberValue : Number.NaN;
}

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function findExistingParentDirectory(pathValue) {
  let current = dirname(pathValue);
  const root = parse(pathValue).root;

  while (current && current !== root && !existsSync(current)) {
    current = dirname(current);
  }

  if (existsSync(current)) {
    try {
      return statSync(current).isDirectory() ? current : null;
    } catch {
      return null;
    }
  }

  return null;
}

module.exports = {
  validateListenerHost,
  toInteger,
  validateApiUrl,
  validateBoolean,
  validateDatabaseUrlPassword,
  validateDistinctPorts,
  validateExistingFile,
  validateExistingOrCreatableDirectory,
  validateHttpOrigin,
  validateHttpUrl,
  validateNodeEnv,
  validateNotPlaceholder,
  validatePort,
  validatePostgresUrl,
};
