import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const configCore = require('./config-core.cjs');

export const findProjectRoot = configCore.findProjectRoot;
export const getRootEnvPath = configCore.getRootEnvPath;
export const getRootEnvExamplePath = configCore.getRootEnvExamplePath;
