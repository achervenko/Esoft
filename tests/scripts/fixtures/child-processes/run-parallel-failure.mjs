import { runParallel } from '../../../../scripts/process/run-parallel.mjs';

runParallel([
  {
    args: ['-e', "setTimeout(() => process.exit(7), 80)"],
    command: process.execPath,
    name: 'failing',
  },
  {
    args: ['-e', 'setInterval(() => undefined, 1_000)'],
    command: process.execPath,
    name: 'long-running',
  },
]);
