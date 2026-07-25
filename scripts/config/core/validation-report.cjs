const { existsSync } = require('node:fs');
const { join } = require('node:path');
const { loadEnvironment } = require('./config-loader.cjs');
const { getRootEnvExamplePath } = require('./project-root.cjs');
const { validateEnvironment } = require('./config-schema.cjs');

function validateConfig(options = {}) {
  try {
    const loadedEnvironment = loadEnvironment(options);
    const result = validateEnvironment(loadedEnvironment.env);

    return {
      ...result,
      envPath: loadedEnvironment.envPath,
      projectRoot: loadedEnvironment.projectRoot,
    };
  } catch (error) {
    if (error?.code === 'ESOFT_ENV_NOT_FOUND') {
      return {
        envPath: error.envPath,
        errors: [
          {
            variable: '.env',
            message:
              'Корневой файл .env не найден. Создайте его из .env.example.',
          },
        ],
        projectRoot: error.projectRoot ?? null,
        valid: false,
        warnings: [],
      };
    }

    return {
      envPath: null,
      errors: [
        {
          variable: 'CONFIG',
          message:
            error instanceof Error
              ? error.message
              : 'Не удалось загрузить конфигурацию.',
        },
      ],
      projectRoot: null,
      valid: false,
      warnings: [],
    };
  }
}

function formatValidationReport(result) {
  if (result.valid && result.warnings.length === 0) {
    return `Конфигурация Esoft корректна.\n\nФайл конфигурации:\n${result.envPath}`;
  }

  const lines = [
    result.valid
      ? 'Конфигурация Esoft корректна с предупреждениями'
      : 'Ошибка конфигурации Esoft',
    '',
  ];

  if (result.errors.length > 0) {
    lines.push('Некорректные значения:');

    for (const error of result.errors) {
      lines.push(`  - ${error.variable}: ${error.message}`);
    }

    lines.push('');
  }

  if (result.warnings.length > 0) {
    lines.push('Предупреждения:');

    for (const warning of result.warnings) {
      lines.push(`  - ${warning.variable}: ${warning.message}`);
    }

    lines.push('');
  }

  if (result.envPath) {
    lines.push('Файл конфигурации:', result.envPath, '');
  }

  const examplePath = result.projectRoot
    ? getRootEnvExamplePath(result.projectRoot)
    : null;

  if (examplePath && existsSync(examplePath)) {
    lines.push('Шаблон:', examplePath, '');
  }

  const documentationPath = result.projectRoot
    ? join(result.projectRoot, 'Документация', 'CONFIGURATION.md')
    : 'Документация/CONFIGURATION.md';

  lines.push('Документация:', documentationPath);

  return lines.join('\n');
}

module.exports = {
  formatValidationReport,
  validateConfig,
};
