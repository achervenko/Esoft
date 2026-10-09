import { createRequire } from 'node:module';
import { resolve } from 'node:path';

type InstallationLease = { lockPath: string; release(): void };
type LockModule = {
  acquireInstallationLock(options: {
    projectRoot: string;
    operation: string;
  }): InstallationLease;
};

export function acquireBackendInstallationLock(projectRoot: string) {
  const requireModule = createRequire(__filename);
  const locks = requireModule(
    resolve(
      projectRoot,
      'scripts/infrastructure/operations/installation-lock.cjs',
    ),
  ) as LockModule;
  return locks.acquireInstallationLock({ projectRoot, operation: 'backend' });
}
