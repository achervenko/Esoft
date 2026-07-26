const SENSITIVE_NAME_PATTERN =
  /\b[A-Z0-9_]*(?:PASSWORD|SECRET|TOKEN|ACCESS_KEY|AUTHORIZATION|DATABASE_URL)[A-Z0-9_]*\b/gi;

const SENSITIVE_ASSIGNMENT_PATTERN =
  /\b([A-Z0-9_]*(?:PASSWORD|SECRET|TOKEN|ACCESS_KEY|AUTHORIZATION|DATABASE_URL)[A-Z0-9_]*)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi;

const URL_CREDENTIALS_PATTERN = /(\b[a-z][a-z0-9+.-]*:\/\/[^:\s/@]+:)([^@\s/]+)(@)/gi;

export function formatError(error) {
  try {
    return redactSensitiveText(
      error instanceof Error ? error.message : String(error),
    );
  } catch {
    return '[unformattable error]';
  }
}

export function redactSecrets(value) {
  return redactValue(value, new WeakSet());
}

export function redactSensitiveText(value) {
  return String(value)
    .replaceAll(URL_CREDENTIALS_PATTERN, '$1[redacted]$3')
    .replaceAll(SENSITIVE_ASSIGNMENT_PATTERN, '$1=[redacted]')
    .replaceAll(SENSITIVE_NAME_PATTERN, '[redacted]');
}

function redactValue(value, ancestors) {
  if (typeof value === 'string') {
    return redactSensitiveText(value);
  }

  if (value !== null && typeof value === 'object') {
    if (ancestors.has(value)) {
      return '[Circular]';
    }

    ancestors.add(value);

    try {
      if (Array.isArray(value)) {
        return value.map((item) => redactValue(item, ancestors));
      }

      return Object.fromEntries(
        Object.entries(value).map(([key, nestedValue]) => [
          redactSensitiveText(key),
          redactValue(nestedValue, ancestors),
        ]),
      );
    } finally {
      ancestors.delete(value);
    }
  }

  return value;
}
