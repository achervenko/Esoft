import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const configCore = require('./config-core.cjs');

export const buildConfig = configCore.buildConfig;
export const requiredVariables = configCore.requiredVariables;
export const secretVariables = configCore.secretVariables;
export const validateEnvironment = configCore.validateEnvironment;
