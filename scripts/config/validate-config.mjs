import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const configCore = require('./config-core.cjs');

export const formatValidationReport = configCore.formatValidationReport;
export const validateConfig = configCore.validateConfig;

const isMainModule =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMainModule) {
  const args = process.argv.slice(2);
  let profile;
  let invalidArguments = false;
  for (let index = 0; index < args.length; index += 1) {
    if (profile !== undefined) { invalidArguments = true; break; }
    if (args[index] === '--profile') {
      const value = args[++index];
      if (!value || value.startsWith('--')) {
        invalidArguments = true;
        break;
      }
      profile = value;
    }
    else if (args[index].startsWith('--profile=')) profile = args[index].slice('--profile='.length);
    else { invalidArguments = true; break; }
  }
  if (profile === undefined) {
    try { profile = configCore.loadEnvironment().env.NODE_ENV === 'production' ? 'production' : 'local'; }
    catch { profile = 'local'; }
  }
  const result = invalidArguments
    ? { valid: false, errors: [{ variable: 'CONFIG_PROFILE', message: 'Используйте --profile local|backend|frontend|production|database|storage-operation.' }], warnings: [], envPath: null, projectRoot: null }
    : validateConfig({ profile });
  console.log(formatValidationReport(result));

  if (!result.valid) {
    process.exitCode = 1;
  }
}
