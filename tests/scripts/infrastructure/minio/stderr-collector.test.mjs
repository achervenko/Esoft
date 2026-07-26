import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';

import { createStderrCollector } from '../../../../scripts/infrastructure/minio/stderr-collector.mjs';

test('stderr collector redacts sensitive names and configured values', () => {
  const child = createChildProcess();
  const stderr = createStderrCollector(child, {
    maxBytes: 1024,
    sensitiveValues: ['root-user', 'root-password', '', undefined],
  });

  child.stderr.emit(
    'data',
    'MINIO_ROOT_PASSWORD=root-password user root-user token=abc',
  );

  const value = stderr.value();

  assert.equal(value.includes('root-password'), false);
  assert.equal(value.includes('root-user'), false);
  assert.equal(value.includes('abc'), false);
});

test('stderr collector returns a bounded tail after redaction', () => {
  const child = createChildProcess();
  const stderr = createStderrCollector(child, {
    maxBytes: 32,
    sensitiveValues: ['secret-value'],
  });

  child.stderr.emit('data', `${'x'.repeat(128)} secret-value tail`);

  const value = stderr.value();

  assert.equal(value.includes('secret-value'), false);
  assert.equal(value.endsWith('tail'), true);
  assert.equal(Buffer.byteLength(value, 'utf8') <= 32, true);
});

test('stderr collector keeps enough boundary bytes to redact split secrets', () => {
  const child = createChildProcess();
  const stderr = createStderrCollector(child, {
    maxBytes: 32,
    sensitiveValues: ['split-secret-value'],
  });

  child.stderr.emit('data', 'prefix split-secret');
  child.stderr.emit('data', '-value suffix');

  const value = stderr.value();

  assert.equal(value.includes('split-secret-value'), false);
  assert.equal(value.includes('[redacted]'), true);
});

test('stderr collector keeps split-secret overlap after UTF-8 alignment', () => {
  const child = createChildProcess();
  const stderr = createStderrCollector(child, {
    maxBytes: 4,
    sensitiveValues: ['secret'],
  });

  child.stderr.emit('data', `${'x'.repeat(12)}€secret`);
  child.stderr.emit('data', 'tail');

  const value = stderr.value();

  assert.equal(value.includes('secret'), false);
  assert.equal(value.includes('\uFFFD'), false);
});

test('stderr collector redacts overlapping values from longest to shortest', () => {
  const child = createChildProcess();
  const stderr = createStderrCollector(child, {
    maxBytes: 1024,
    sensitiveValues: ['user', 'user-secret', 'user'],
  });

  child.stderr.emit('data', 'login failed for user-secret');

  const value = stderr.value();

  assert.equal(value.includes('user-secret'), false);
  assert.equal(value.includes('-secret'), false);
});

test('stderr collector redacts configured values before trimming diagnostics', () => {
  const child = createChildProcess();
  const stderr = createStderrCollector(child, {
    maxBytes: 1024,
    sensitiveValues: [' secret'],
  });

  child.stderr.emit('data', ' secret');

  const value = stderr.value();

  assert.equal(value, '[redacted]');
  assert.equal(value.includes('secret'), false);
});

test('stderr collector truncates UTF-8 diagnostics on character boundaries', () => {
  const child = createChildProcess();
  const stderr = createStderrCollector(child, {
    maxBytes: 1,
  });

  child.stderr.emit('data', 'Ж');

  const value = stderr.value();

  assert.equal(value.includes('\uFFFD'), false);
  assert.equal(Buffer.byteLength(value, 'utf8') <= 1, true);
});

test('stderr collector validates maxBytes', () => {
  assert.throws(
    () =>
      createStderrCollector(createChildProcess(), {
        maxBytes: 0,
      }),
    {
      message: 'maxBytes must be a positive safe integer',
      name: 'TypeError',
    },
  );

  assert.throws(
    () =>
      createStderrCollector(createChildProcess(), {
        maxBytes: Number.MAX_SAFE_INTEGER + 1,
      }),
    {
      message: 'maxBytes must be a positive safe integer',
      name: 'TypeError',
    },
  );
});

test('stderr collector validates the combined internal buffer limit', () => {
  assert.throws(
    () =>
      createStderrCollector(createChildProcess(), {
        maxBytes: Number.MAX_SAFE_INTEGER,
      }),
    {
      message: 'Combined stderr buffer limit is too large',
      name: 'RangeError',
    },
  );
});

function createChildProcess() {
  return {
    stderr: new EventEmitter(),
  };
}

test('stderr collector decodes split UTF-8 Buffer chunks without corruption', () => {
  const child = createChildProcess();
  const stderr = createStderrCollector(child, {
    maxBytes: 1024,
    sensitiveValues: ['secret'],
  });

  const buffer = Buffer.from('prefix Жsecret suffix', 'utf8');
  const characterStart = Buffer.byteLength('prefix ', 'utf8');

  child.stderr.emit(
    'data',
    buffer.subarray(0, characterStart + 1),
  );
  child.stderr.emit(
    'data',
    buffer.subarray(characterStart + 1),
  );

  const value = stderr.value();

  assert.equal(value.includes('\uFFFD'), false);
  assert.equal(value.includes('secret'), false);
  assert.equal(value.includes('[redacted]'), true);
});

test('stderr collector enforces maxBytes after redaction expands output', () => {
  const child = createChildProcess();
  const stderr = createStderrCollector(child, {
    maxBytes: 4,
    sensitiveValues: ['x'],
  });

  child.stderr.emit('data', 'x');

  const value = stderr.value();

  assert.equal(value.includes('x'), false);
  assert.equal(value.includes('\uFFFD'), false);
  assert.equal(Buffer.byteLength(value, 'utf8') <= 4, true);
});

test('stderr collector validates sensitiveValues', () => {
  assert.throws(
    () =>
      createStderrCollector(createChildProcess(), {
        sensitiveValues: 'secret',
      }),
    {
      message: 'sensitiveValues must be an array',
      name: 'TypeError',
    },
  );
});