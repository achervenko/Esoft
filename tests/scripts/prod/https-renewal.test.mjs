import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const quote = (value) => `'${value.replaceAll("'", "''")}'`;
const token = 'a'.repeat(43);
const source = resolve('deploy/windows/certificates');

async function fixture(scriptName) {
  const root = await mkdtemp(join(tmpdir(), 'esoft-acme-test-'));
  await copyFile(join(source, scriptName), join(root, scriptName));
  await writeFile(join(root, 'renewal-settings.json'), JSON.stringify({ AllowedZone: 'insolution-esoft.ru', CaddyPath: join(root, 'fake-caddy.ps1'), CaddyfilePath: join(root, 'Caddyfile') }));
  await writeFile(join(root, 'calls.txt'), '');
  return root;
}

function run(root, text) {
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', text], { encoding: 'utf8', windowsHide: true, timeout: 15000 });
  assert.equal(result.error, undefined);
  return result;
}

for (const scenario of [
  { name: 'maps Win-ACME full RecordName to REG.RU short subdomain', action: 'create', zone: 'insolution-esoft.ru', record: '_acme-challenge.insolution-esoft.ru', expected: ['get_resource_records', 'add_txt'] },
  { name: 'does not duplicate an existing token', action: 'create', exists: true, expected: ['get_resource_records'] },
  { name: 'deletes only the exact token', action: 'delete', exists: true, expected: ['get_resource_records', 'remove_record'] },
  { name: 'missing token cleanup leaves other records alone', action: 'delete', expected: ['get_resource_records'] },
  { name: 'rejects failed API responses without leaking credentials', action: 'create', error: 'api', expected: ['get_resource_records'], code: 1 },
  { name: 'rejects per-zone errors despite a successful API envelope', action: 'create', error: 'zone', expected: ['get_resource_records'], code: 1 },
  { name: 'redacts transport errors containing secrets', action: 'create', error: 'transport', expected: ['get_resource_records'], code: 1 },
  { name: 'rejects foreign zones before API access', action: 'create', zone: 'other.example', expected: [], code: 1 },
  { name: 'rejects a foreign record name before API access', action: 'create', record: '_acme-challenge.other.example', expected: [], code: 1 },
  { name: 'rejects another node in the allowed zone', action: 'delete', record: 'other.insolution-esoft.ru', expected: [], code: 1 },
  { name: 'rejects the obsolete short RecordName contract', action: 'create', record: '_acme-challenge', expected: [], code: 1 },
  { name: 'rejects malformed challenge token before API access', action: 'create', token: 'bad', expected: [], code: 1 },
]) {
  test(`REG.RU hook ${scenario.name}`, { skip: process.platform !== 'win32' }, async () => {
    const root = await fixture('RegRu-Dns.ps1');
    try {
      const result = run(root, `
function Import-Clixml { param($LiteralPath); $secret = [Security.SecureString]::new(); 'never-print-this-password'.ToCharArray() | ForEach-Object { $secret.AppendChar($_) }; return [pscredential]::new('test-login', $secret) }
function Invoke-RestMethod {
  param($Uri, $Method, $ContentType, $Body, $TimeoutSec, $Verbose, $Debug)
  $request = $Body.input_data | ConvertFrom-Json
  if ($Method -ne 'Post' -or $Body.input_format -ne 'json' -or $request.domains[0].dname -ne 'insolution-esoft.ru') { throw 'Bad request' }
  if ($request.password -ne 'never-print-this-password') { throw 'Missing credential' }
  $operation = ($Uri -split '/')[-1]
  Add-Content -LiteralPath ${quote(join(root, 'calls.txt'))} -Value $operation
  ${scenario.error === 'transport' ? "throw 'never-print-this-password'" : ''}
  if ($operation -ne 'get_resource_records') {
    if ($request.subdomain -cne '_acme-challenge') { throw 'Bad record scope' }
    if ($operation -eq 'add_txt' -and ($request.text -cne '${token}' -or $request.PSObject.Properties.Name -contains 'content')) { throw 'Bad creation payload' }
    if ($operation -eq 'remove_record' -and ($request.content -cne '${token}' -or $request.record_type -cne 'TXT' -or $request.PSObject.Properties.Name -contains 'text')) { throw 'Bad deletion payload' }
  }
  return @{ result = '${scenario.error === 'api' ? 'error' : 'success'}'; answer = @{ domains = @(@{ dname = 'insolution-esoft.ru'; result = '${scenario.error === 'zone' ? 'error' : 'success'}'; rrs = @(
    @{ rectype = 'TXT'; subname = '_acme-challenge'; content = '${scenario.exists ? token : 'unrelated-token'}' },
    @{ rectype = 'TXT'; subname = 'other'; content = '${token}' }
  ) }) } }
}
& ${quote(join(root, 'RegRu-Dns.ps1'))} ${scenario.action} ${scenario.zone ?? 'insolution-esoft.ru'} ${scenario.record ?? '_acme-challenge.insolution-esoft.ru'} ${scenario.token ?? token}
exit $LASTEXITCODE
`);
      assert.equal(result.status, scenario.code ?? 0, result.stdout + result.stderr);
      assert.doesNotMatch(result.stdout + result.stderr, /never-print-this-password/);
      const calls = (await readFile(join(root, 'calls.txt'), 'utf8')).trim().split(/\r?\n/).filter(Boolean);
      assert.deepEqual(calls, scenario.expected);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
}

for (const scenario of [
  { name: 'validates then forces certificate reload', validate: 0, reload: 0, expected: ['validate', 'reload'], code: 0 },
  { name: 'does not reload an invalid config', validate: 1, reload: 0, expected: ['validate'], code: 1 },
  { name: 'reports reload failure', validate: 0, reload: 1, expected: ['validate', 'reload'], code: 1 },
]) {
  test(`proxy hook ${scenario.name}`, { skip: process.platform !== 'win32' }, async () => {
    const root = await fixture('Reload-EsoftProxy.ps1');
    try {
      await writeFile(join(root, 'Caddyfile'), 'mock');
      await writeFile(join(root, 'fake-caddy.ps1'), `
Add-Content -LiteralPath ${quote(join(root, 'calls.txt'))} -Value $args[0]
if ($args[0] -eq 'reload' -and $args -notcontains '--force') { throw 'Missing force flag' }
if ($args[0] -eq 'validate') { $global:LASTEXITCODE = ${scenario.validate} } else { $global:LASTEXITCODE = ${scenario.reload} }
`);
      const result = run(root, `& ${quote(join(root, 'Reload-EsoftProxy.ps1'))}; exit $LASTEXITCODE`);
      assert.equal(result.status, scenario.code, result.stdout + result.stderr);
      const calls = (await readFile(join(root, 'calls.txt'), 'utf8')).trim().split(/\r?\n/).filter(Boolean);
      assert.deepEqual(calls, scenario.expected);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
}
