import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { loadOptionalWarehouseModule } from './optional-warehouse-module';

it('never loads warehouse code while disabled and loads it only when selected', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'esoft-module-selection-'));
  try {
    mkdirSync(resolve(root, 'scripts/database'), { recursive: true });
    mkdirSync(resolve(root, 'backend/prisma'), { recursive: true });
    cpSync(
      resolve(__dirname, '../../prisma/module-catalog.json'),
      resolve(root, 'backend/prisma/module-catalog.json'),
    );
    cpSync(
      resolve(__dirname, '../../../scripts/database/packages.cjs'),
      resolve(root, 'scripts/database/packages.cjs'),
    );
    const load = jest.fn(() => ({ WarehouseModule: class WarehouseModule {} }));
    writeFileSync(
      resolve(root, 'database-packages.json'),
      '{"modules":["equipment","ppe"]}',
    );
    expect(loadOptionalWarehouseModule(root, load)).toEqual([]);
    expect(load).not.toHaveBeenCalled();
    writeFileSync(
      resolve(root, 'database-packages.json'),
      '{"modules":["warehouse"]}',
    );
    expect(loadOptionalWarehouseModule(root, load)).toHaveLength(1);
    expect(load).toHaveBeenCalledTimes(1);
    writeFileSync(
      resolve(root, 'database-packages.json'),
      '{"modules":["unknown"]}',
    );
    expect(() => loadOptionalWarehouseModule(root, load)).toThrow();
    expect(load).toHaveBeenCalledTimes(1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
