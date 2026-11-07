import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { loadActiveModules } from './active-modules.module';
import { loadOptionalModules } from './optional-modules';

it('loads only the selected modules and their package dependencies', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'esoft-module-selection-'));
  try {
    mkdirSync(resolve(root, 'scripts/database'), { recursive: true });
    mkdirSync(resolve(root, 'backend/prisma'), { recursive: true });
    cpSync(
      resolve(__dirname, '../../prisma/module-catalog.json'),
      resolve(root, 'backend/prisma/module-catalog.json'),
    );
    cpSync(
      resolve(__dirname, '../../prisma/packages'),
      resolve(root, 'backend/prisma/packages'),
      { recursive: true },
    );
    cpSync(
      resolve(__dirname, '../../../scripts/database/packages.cjs'),
      resolve(root, 'scripts/database/packages.cjs'),
    );
    class OrdersModule {}
    class WarehouseModule {}
    const load = jest.fn(
      (path: string): Record<string, typeof OrdersModule> => {
        if (path === '../orders/orders.module') return { OrdersModule };
        if (path === '../warehouse/warehouse.module')
          return { WarehouseModule };
        throw new Error(`Unexpected module: ${path}`);
      },
    );
    const loadSelected = () =>
      loadOptionalModules(loadActiveModules(root), load);
    writeFileSync(resolve(root, 'database-packages.json'), '{"modules":[]}');
    expect(loadSelected()).toEqual([]);
    expect(load).not.toHaveBeenCalled();
    writeFileSync(
      resolve(root, 'database-packages.json'),
      '{"modules":["orders"]}',
    );
    expect(loadSelected()).toEqual([OrdersModule]);
    expect(load.mock.calls).toEqual([['../orders/orders.module']]);
    load.mockClear();

    writeFileSync(
      resolve(root, 'database-packages.json'),
      '{"modules":["warehouse"]}',
    );
    expect(loadSelected()).toEqual([OrdersModule, WarehouseModule]);
    expect(load.mock.calls).toEqual([
      ['../orders/orders.module'],
      ['../warehouse/warehouse.module'],
    ]);
    writeFileSync(
      resolve(root, 'database-packages.json'),
      '{"modules":["unknown"]}',
    );
    expect(loadSelected).toThrow();
    expect(load).toHaveBeenCalledTimes(2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
