import { runParallel } from '../../../../scripts/process/run-parallel.mjs';

runParallel([
  {
    args: [],
    command: 'missing-DATABASE_URL=TEST_DATABASE_SECRET_DO_NOT_PRINT-command',
    name: 'secret-spawn',
  },
]);
