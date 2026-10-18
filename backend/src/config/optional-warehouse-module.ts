import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import type { Type } from '@nestjs/common';

const requireModule = createRequire(__filename);

export function loadOptionalWarehouseModule(
  projectRoot: string,
  loadModule: () => { WarehouseModule: Type<unknown> } = () =>
    requireModule('../warehouse/warehouse.module') as {
      WarehouseModule: Type<unknown>;
    },
): Type<unknown>[] {
  const packageTools = requireModule(
    resolve(projectRoot, 'scripts/database/packages.cjs'),
  ) as { readPackageSelection(root: string): string[] };
  if (!packageTools.readPackageSelection(projectRoot).includes('warehouse'))
    return [];
  return [loadModule().WarehouseModule];
}
