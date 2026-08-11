export function normalizeOptionalEnv(value) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

export function compactOutput(output) {
  return output.replaceAll(/\s+/g, ' ').trim() || '<empty output>';
}

export function displayName(name) {
  return name[0].toUpperCase() + name.slice(1);
}

export { formatError } from '../infrastructure/security/redaction.mjs';

export function delay(ms) {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, ms);
  });
}
