import {
  npmArgs,
  npmCommandName,
  npmScriptArgs,
  runCommand,
  runParallel,
} from './process/run-parallel.mjs';

const npm = npmCommandName();

const validation = await runCommand(npm, npmArgs(['run', 'config:validate']));

if (validation.code !== 0) {
  process.exit(validation.code ?? 1);
}

console.log('[project] Configuration validated');

runParallel([
  {
    args: npmScriptArgs('start:prod', 'backend'),
    command: npm,
    name: 'backend',
  },
  {
    args: npmScriptArgs('preview', 'frontend'),
    command: npm,
    name: 'frontend',
  },
]);
