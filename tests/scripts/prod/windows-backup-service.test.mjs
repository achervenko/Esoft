import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const quote = (value) => `'${value.replaceAll("'", "''")}'`;

for (const scenario of [
  { name: 'successful backup restores running backend', status: 'Running', code: 0, expected: ['stop', 'start'] },
  { name: 'failed backup restores running backend and reports failure', status: 'Running', code: 1, expected: ['stop', 'start'] },
  { name: 'stopped backend stays stopped', status: 'Stopped', code: 0, expected: [] },
  { name: 'LeaveStopped stops backend without restarting it', status: 'Running', code: 0, leaveStopped: true, expected: ['stop'] },
  { name: 'failed backup with LeaveStopped keeps backend stopped', status: 'Running', code: 1, leaveStopped: true, expected: ['stop'] },
  { name: 'restart failure is reported after successful backup', status: 'Running', code: 0, restartError: true, expected: ['stop', 'start'] },
]) {
  test(scenario.name, { skip: process.platform !== 'win32' }, async () => {
    const root = await mkdtemp(join(tmpdir(), 'esoft-service-test-'));
    try {
      const scripts = join(root, 'scripts', 'prod');
      await mkdir(scripts, { recursive: true });
      await writeFile(join(scripts, 'backup-prod.mjs'), `process.exit(${scenario.code});`);
      const log = join(root, 'events.txt');
      await writeFile(log, '');
      const wrapper = join(root, 'test.ps1');
      await writeFile(wrapper, `
function Get-Service {
  param($Name)
  if ($Name -ne 'FakeBackend') { throw 'Unexpected service' }
  $service = [pscustomobject]@{ Status = '${scenario.status}' }
  $service | Add-Member -MemberType ScriptMethod -Name WaitForStatus -Value { param($Status, $Timeout) }
  return $service
}
function Stop-Service { param($Name); if ($Name -ne 'FakeBackend') { throw 'Unexpected service' }; Add-Content -LiteralPath ${quote(log)} -Value 'stop' }
function Start-Service { param($Name); if ($Name -ne 'FakeBackend') { throw 'Unexpected service' }; Add-Content -LiteralPath ${quote(log)} -Value 'start'; ${scenario.restartError ? "throw 'Simulated restart failure'" : ''} }
& ${quote(resolve('deploy/windows/Invoke-EsoftBackup.ps1'))} -ProjectRoot ${quote(root)} -NodePath ${quote(process.execPath)} -BackendService FakeBackend ${scenario.leaveStopped ? '-LeaveStopped' : ''}
exit $LASTEXITCODE
`);
      const child = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', wrapper], { encoding: 'utf8', timeout: 15000, windowsHide: true });
      assert.equal(child.error, undefined);
      assert.equal(child.status, scenario.restartError ? 1 : scenario.code, child.stdout + child.stderr);
      if (scenario.code === 0)
        assert.match(child.stdout, /Backup completed successfully\./);
      else
        assert.doesNotMatch(child.stdout, /Backup completed successfully\./);
      if (scenario.restartError)
        assert.match(child.stderr, /Backup succeeded, but backend service\s+failed to restart\./);
      const events = (await readFile(log, 'utf8')).trim().split(/\r?\n/).filter(Boolean);
      assert.deepEqual(events, scenario.expected);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}
