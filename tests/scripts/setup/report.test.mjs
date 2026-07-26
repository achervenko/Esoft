import assert from 'node:assert/strict';
import test from 'node:test';

import { createSetupReport } from '../../../scripts/setup/report.mjs';
import { failure, success } from '../../../scripts/infrastructure/result.mjs';

test('setup report prints successful steps once', () => {
  const lines = captureConsole(() => {
    const report = createSetupReport();
    report.addStep('Configuration', success('CONFIG_VALID', 'Configuration is valid'));
    report.addStep('PostgreSQL', success('POSTGRES_OK', 'PostgreSQL is ready'));
    report.print();
    report.print();
  });

  assert.deepEqual(lines, [
    '',
    'Esoft Setup',
    '',
    'Configuration......... OK',
    'PostgreSQL............ OK',
    '',
    'Setup completed. You can start the application.',
  ]);
});

test('setup report prints first failure without adding punctuation', () => {
  const lines = captureConsole(() => {
    const report = createSetupReport();
    report.addStep('Configuration', success('CONFIG_VALID', 'Configuration is valid'));
    report.addStep(
      'MinIO',
      failure('MINIO_FAILED', 'MinIO is unavailable.'),
    );
    report.addStep(
      'Seed data',
      failure('SEED_FAILED', 'Seed failed'),
    );
    report.print();
  });

  assert.deepEqual(lines, [
    '',
    'Esoft Setup',
    '',
    'Configuration......... OK',
    'MinIO................. FAILED',
    'Seed data............. FAILED',
    '',
    'Setup failed: MinIO is unavailable.',
    'Run `npm run doctor` for detailed diagnostics.',
  ]);
});

function captureConsole(callback) {
  const lines = [];
  const originalLog = console.log;

  console.log = (...args) => {
    lines.push(args.join(' '));
  };

  try {
    callback();
  } finally {
    console.log = originalLog;
  }

  return lines;
}
