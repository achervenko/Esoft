import assert from 'node:assert/strict';
import test from 'node:test';

import { createReport } from '../../../scripts/doctor/report.mjs';

test('doctor report preserves sections, statuses and summary counts', () => {
  const lines = captureConsole(() => {
    const report = createReport();
    report.add('Configuration', 'OK', 'Configuration valid');
    report.add('MinIO', 'STARTED', 'MinIO started temporarily');
    report.add('MinIO', 'STOPPED', 'MinIO stopped');
    report.add('Backend', 'ERROR', 'Health endpoint failed');
    report.add('Frontend', 'WARN', 'Slow response');
    report.print();
  });

  assert.deepEqual(lines, [
    '',
    'Project Doctor',
    '',
    'Configuration',
    '  [OK] Configuration valid',
    '',
    'MinIO',
    '  [STARTED] MinIO started temporarily',
    '  [STOPPED] MinIO stopped',
    '',
    'Backend',
    '  [ERROR] Health endpoint failed',
    '',
    'Frontend',
    '  [WARN] Slow response',
    '',
    'Result: 1 passed, 1 error, 1 warnings, 0 skipped, 1 started, 1 stopped',
  ]);
});

test('doctor report exposes the current number of errors', () => {
  const report = createReport();

  assert.equal(report.errorCount, 0);

  report.add('Backend', 'ERROR', 'Failed');
  assert.equal(report.errorCount, 1);

  report.add('Frontend', 'OK', 'Ready');
  report.add('MinIO', 'WARN', 'Slow');
  assert.equal(report.errorCount, 1);

  report.add('PostgreSQL', 'ERROR', 'Unavailable');
  assert.equal(report.errorCount, 2);
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
