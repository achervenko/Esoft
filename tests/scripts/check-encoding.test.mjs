import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const checker = new URL('../../tools/check-encoding.mjs', import.meta.url);

async function checkEncoding(t, content) {
  const root = await mkdtemp(join(tmpdir(), 'esoft-encoding-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const tools = join(root, 'tools');
  await mkdir(tools);
  const script = join(tools, 'check-encoding.mjs');
  await copyFile(checker, script);
  await writeFile(join(root, 'sample.md'), content);
  const result = spawnSync(process.execPath, [script, '--strict'], {
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.ifError(result.error);
  return result;
}

test('strict encoding accepts Cyrillic text and guillemets', async (t) => {
  const result = await checkEncoding(
    t,
    '«Заказы клиентов 1С». «Склады 1С». «СИЗ РФ». «ОТК и БТИ СССР». Ёж, «Р» и «С».',
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

for (const [name, content, diagnostic] of [
  ['malformed UTF-8', Buffer.from([0xd0, 0x20]), /U\+FFFD/],
  ['replacement character', '\uFFFD', /U\+FFFD/],
  [
    'UTF-8 decoded as Latin-1',
    Buffer.from('Приход').toString('latin1'),
    /повреждённой кодировки/,
  ],
  [
    'UTF-8 letter decoded as Windows-1251',
    new TextDecoder('windows-1251').decode(Buffer.from('е')),
    /повреждённой кодировки/,
  ],
  [
    'UTF-8 decoded as Windows-1251',
    new TextDecoder('windows-1251').decode(Buffer.from('лл')),
    /повреждённой кодировки/,
  ],
  ['Windows-1251 mixed sequence', '\u0432\u0402', /повреждённой кодировки/],
  [
    'Latin-1 replacement sequence',
    '\u00ef\u00bf\u00bd',
    /повреждённой кодировки/,
  ],
]) {
  test(`strict encoding reports ${name}`, async (t) => {
    const result = await checkEncoding(t, content);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, diagnostic);
  });
}
