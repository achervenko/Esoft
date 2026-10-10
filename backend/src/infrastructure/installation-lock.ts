import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { createServer } from 'node:net';

type InstallationLease = { lockPath: string; release(): void };
type LockModule = {
  acquireInstallationLock(options: {
    projectRoot: string;
    operation: string;
    recoverBackend?: boolean;
  }): InstallationLease;
};

export async function acquireBackendInstallationLock(
  projectRoot: string,
  port: number,
  host: string,
) {
  const portFree = await new Promise<boolean>((done) => {
    const server = createServer();
    server.once('error', () => done(false));
    server.listen(port, host, () => server.close(() => done(true)));
  });
  const requireModule = createRequire(__filename);
  const locks = requireModule(
    resolve(
      projectRoot,
      'scripts/infrastructure/operations/installation-lock.cjs',
    ),
  ) as LockModule;
  return locks.acquireInstallationLock({
    projectRoot,
    operation: 'backend',
    recoverBackend: portFree,
  });
}
