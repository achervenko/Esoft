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
  const result = validateConfig();
  console.log(formatValidationReport(result));

  if (!result.valid) {
    process.exitCode = 1;
  }
}
