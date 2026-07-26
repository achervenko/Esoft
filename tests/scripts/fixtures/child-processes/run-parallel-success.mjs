import { runParallel } from '../../../../scripts/process/run-parallel.mjs';

runParallel([
  {
    args: [
      '-e',
      "console.log('first-child-started'); setTimeout(() => process.exit(0), 80)",
    ],
    command: process.execPath,
    name: 'first',
  },
  {
    args: [
      '-e',
      "console.log('second-child-started'); setTimeout(() => process.exit(0), 160)",
    ],
    command: process.execPath,
    name: 'second',
  },
]);
