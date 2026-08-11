import {
  createNpmInvocation,
  npmArgs,
} from './infrastructure/commands/npm-command.mjs';
import {
  runCommand,
  runParallel,
} from './process/run-parallel.mjs';

const npmInvocation = createNpmInvocation();

const validation = await runCommand(
  npmInvocation.command,
  [
    ...npmInvocation.argsPrefix,
    ...npmArgs(['run', 'config:validate']),
  ],
);

if (validation.code !== 0) {
  process.exit(validation.code ?? 1);
}

console.log('[project] Configuration validated');

runParallel([
  {
    args: [
      ...npmInvocation.argsPrefix,
      ...npmArgs(['run', 'start:prod', '--workspace', 'backend']),
    ],
    command: npmInvocation.command,
    name: 'backend',
  },
  {
    args: [
      ...npmInvocation.argsPrefix,
      ...npmArgs(['run', 'preview', '--workspace', 'frontend']),
    ],
    command: npmInvocation.command,
    name: 'frontend',
  },
]);
