import { Module } from '@nestjs/common';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { loadRootEnvironment } from './root-environment';

export const ACTIVE_MODULES = Symbol('ACTIVE_MODULES');
const requireModule = createRequire(__filename);

export function loadActiveModules(
  projectRoot = loadRootEnvironment().projectRoot,
): readonly string[] {
  const tools = requireModule(
    resolve(projectRoot, 'scripts/database/packages.cjs'),
  ) as {
    readPackageSelection(root: string): string[];
  };
  return Object.freeze([...tools.readPackageSelection(projectRoot)]);
}

@Module({
  providers: [
    { provide: ACTIVE_MODULES, useFactory: () => loadActiveModules() },
  ],
  exports: [ACTIVE_MODULES],
})
export class ActiveModulesModule {}
