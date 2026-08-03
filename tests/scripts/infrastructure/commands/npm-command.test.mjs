import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createNpmInvocation,
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

test('createNpmInvocation uses npm_execpath through the current node executable', () => {
  assert.deepEqual(
    createNpmInvocation({
      execPath: 'C:/Program Files/nodejs/node.exe',
      npmExecPath:
        'C:/Users/alex/AppData/Roaming/npm/node_modules/npm/bin/npm-cli.js',
      platform: 'win32',
    }),
    {
      command: 'C:/Program Files/nodejs/node.exe',
      argsPrefix: [
        'C:/Users/alex/AppData/Roaming/npm/node_modules/npm/bin/npm-cli.js',
      ],
    },
  );
});

test('createNpmInvocation falls back to npm.cmd on Windows without npm_execpath', () => {
  assert.deepEqual(
    createNpmInvocation({
      npmExecPath: undefined,
      platform: 'win32',
    }),
    {
      command: 'npm.cmd',
      argsPrefix: [],
    },
  );

  assert.deepEqual(
    createNpmInvocation({
      npmExecPath: '   ',
      platform: 'win32',
    }),
    {
      command: 'npm.cmd',
      argsPrefix: [],
    },
  );
});

test('createNpmInvocation falls back to npm on POSIX without npm_execpath', () => {
  assert.deepEqual(
    createNpmInvocation({
      npmExecPath: '',
      platform: 'linux',
    }),
    {
      command: 'npm',
      argsPrefix: [],
    },
  );
});

test('createNpmInvocation preserves paths with spaces as separate arguments', () => {
  assert.deepEqual(
    createNpmInvocation({
      execPath: 'C:/Program Files/nodejs/node.exe',
      npmExecPath: 'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js',
      platform: 'win32',
    }),
    {
      command: 'C:/Program Files/nodejs/node.exe',
      argsPrefix: [
        'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js',
      ],
    },
  );
});
