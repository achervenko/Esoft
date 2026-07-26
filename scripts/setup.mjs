import { runSetup } from './setup/setup.mjs';

const exitCode = await runSetup();
process.exitCode = exitCode;
