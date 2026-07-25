import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

describe('@thallesp/nestjs-better-auth integration', () => {
  it('allows @AllowAnonymous routes and protects other routes without authentication', () => {
    const result = spawnSync(
      process.execPath,
      [join('test', 'health-public-auth.integration.mjs')],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    );

    if (result.error || result.status !== 0) {
      throw new Error(
        [result.error?.message, result.stdout, result.stderr]
          .filter(Boolean)
          .join('\n'),
      );
    }
  });
});
