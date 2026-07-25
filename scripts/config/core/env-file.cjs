const { readFileSync } = require('node:fs');

function parseEnvFile(envPath) {
  const content = readFileSync(envPath, 'utf8').replace(/^\uFEFF/, '');
  const env = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const normalizedLine = line.startsWith('export ')
      ? line.slice('export '.length).trim()
      : line;
    const separatorIndex = normalizedLine.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const key = normalizedLine.slice(0, separatorIndex).trim();
    const rawValue = normalizedLine.slice(separatorIndex + 1).trim();

    if (!key) {
      continue;
    }

    env[key] = parseEnvValue(rawValue);
  }

  return env;
}

function parseEnvValue(rawValue) {
  if (
    (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
    (rawValue.startsWith("'") && rawValue.endsWith("'"))
  ) {
    return rawValue
      .slice(1, -1)
      .replaceAll('\\n', '\n')
      .replaceAll('\\"', '"')
      .replaceAll("\\'", "'");
  }

  const hashIndex = rawValue.indexOf(' #');
  return hashIndex === -1 ? rawValue : rawValue.slice(0, hashIndex).trimEnd();
}

function applyEnvironment(env, options = {}) {
  const override = options.override ?? false;

  for (const [key, value] of Object.entries(env)) {
    if (override || process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

module.exports = {
  applyEnvironment,
  parseEnvFile,
};
