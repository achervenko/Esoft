import assert from 'node:assert/strict';
import test from 'node:test';

import { createSpawnConfig } from '../../../../scripts/infrastructure/commands/spawn-config.mjs';

test('createSpawnConfig preserves non-Windows command and arguments', () => {
  assert.deepEqual(createSpawnConfig('node', ['value with spaces'], 'linux'), {
    args: ['value with spaces'],
    command: 'node',
    windowsVerbatimArguments: false,
  });
});

test('createSpawnConfig creates the expected Windows cmd configuration', () => {
  assert.deepEqual(
    createSpawnConfig(
      'npm.cmd',
      ['run', 'script with spaces'],
      'win32',
      'C:\\Windows\\System32\\cmd.exe',
    ),
    {
      args: [
        '/d',
        '/s',
        '/c',
        '""npm.cmd" "run" "script with spaces""',
      ],
      command: 'C:\\Windows\\System32\\cmd.exe',
      windowsVerbatimArguments: true,
    },
  );
});

test('createSpawnConfig detects Windows batch commands case-insensitively', () => {
  assert.deepEqual(
    createSpawnConfig(
      'C:\\Program Files\\nodejs\\NPM.CMD',
      ['--version'],
      'win32',
      'C:\\Windows\\System32\\cmd.exe',
    ),
    {
      args: [
        '/d',
        '/s',
        '/c',
        '""C:\\Program Files\\nodejs\\NPM.CMD" "--version""',
      ],
      command: 'C:\\Windows\\System32\\cmd.exe',
      windowsVerbatimArguments: true,
    },
  );
});

test('createSpawnConfig rejects unsafe Windows batch arguments', () => {
  for (const value of ['%PATH%', '!VAR!', 'a"b', 'a\nb', 'a\rb']) {
    assert.throws(
      () =>
        createSpawnConfig(
          'npm.cmd',
          [value],
          'win32',
          'C:\\Windows\\System32\\cmd.exe',
        ),
      TypeError,
    );
  }
});

test('createSpawnConfig rejects unsafe Windows batch command paths', () => {
  assert.throws(
    () =>
      createSpawnConfig(
        'C:\\bad%PATH%\\npm.cmd',
        ['run'],
        'win32',
        'C:\\Windows\\System32\\cmd.exe',
      ),
    TypeError,
  );
});
