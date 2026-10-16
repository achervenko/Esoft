import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { createIsolatedPostgres } from '../../helpers/isolated-postgres.mjs';
import { runCommand } from '../../../../scripts/infrastructure/commands/run-command.mjs';

const project = resolve(import.meta.dirname, '../../../..');

test('existing PPE and concurrent numbering integration suites work on extracted packages', {
  skip: process.env.ESOFT_MODULAR_MIGRATION_TEST !== '1', timeout: 180000,
}, async () => {
  const environment = await createIsolatedPostgres();
  try {
    const files = [
      'backend/test/numbering/identity-numbering.integration.test.mjs',
      'backend/test/ppe-norms/ppe-norms.integration.setup.mjs',
      'backend/test/ppe-issues/ppe-issues.integration.setup.mjs',
      'backend/test/ppe-issues/ppe-interval-obligations.integration.test.mjs',
    ];
    const report = [];
    for (const file of files) {
      const childEnv = { ...process.env, ESOFT_TEST_DATABASE_URL: environment.urlFor('postgres') };
      // A fresh test runner must not inherit the parent runner's worker context.
      delete childEnv.NODE_TEST_CONTEXT;
      const result = await runCommand(process.execPath, ['--test', '--test-reporter=spec', resolve(project, file)], {
        cwd: project,
        env: childEnv,
        timeoutMs: 90000,
      });
      report.push({ file, code: result.code, stdout: result.stdout, stderr: result.stderr });
      const output = join(project, '.local/modular-migrations-probe');
      await mkdir(output, { recursive: true });
      await writeFile(join(output, 'behavior.json'), JSON.stringify(report, null, 2) + '\n');
      console.log(`${file}: exit=${result.code}; ${result.stdout.split('\n').filter((line) => /tests |pass |fail /.test(line)).join('; ')}`);
      assert.equal(result.ok, true, result.stdout + '\n' + result.stderr);
      assert.match(result.stdout, /tests [1-9]\d*/);
      assert.doesNotMatch(result.stderr, /skipping running files/);
    }
  } finally { await environment.close(); }
});
