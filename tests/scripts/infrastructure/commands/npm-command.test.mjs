import assert from 'node:assert/strict';
import test from 'node:test';

import {
  npmArgs,
  npmCommandName,
  npmScriptArgs,
} from '../../../../scripts/infrastructure/commands/npm-command.mjs';

test('npmCommandName returns npm.cmd on Windows', () => {
  assert.equal(npmCommandName('win32'), 'npm.cmd');
});

test('npmCommandName returns npm on non-Windows platforms', () => {
  assert.equal(npmCommandName('linux'), 'npm');
  assert.equal(npmCommandName('darwin'), 'npm');
});

test('npmArgs preserves argument boundaries', () => {
  assert.deepEqual(
    npmArgs(['run', 'script with spaces', '--flag=value']),
    ['run', 'script with spaces', '--flag=value'],
  );
});

test('npmScriptArgs passes extra script arguments after --', () => {
  assert.deepEqual(
    npmScriptArgs('test', 'backend', ['--runInBand', 'value with space']),
    [
      'run',
      'test',
      '--workspace',
      'backend',
      '--',
      '--runInBand',
      'value with space',
    ],
  );
});

test('npmScriptArgs omits -- when there are no extra arguments', () => {
  assert.deepEqual(
    npmScriptArgs('lint', 'frontend'),
    ['run', 'lint', '--workspace', 'frontend'],
  );
});
