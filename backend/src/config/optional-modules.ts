import { createRequire } from 'node:module';
import type { Type } from '@nestjs/common';

const requireModule = createRequire(__filename);

const optionalModules = [
  {
    id: 'equipment',
    path: '../equipment/equipment.module',
    exportName: 'EquipmentModule',
  },
  {
    id: 'equipment',
    path: '../equipment-events/equipment-maintenance.module',
    exportName: 'EquipmentMaintenanceModule',
  },
  {
    id: 'equipment',
    path: '../equipment-progress-dashboard/equipment-progress-dashboard.module',
    exportName: 'EquipmentProgressDashboardModule',
  },
  { id: 'ppe', path: '../ppe/ppe.module', exportName: 'PpeModule' },
  {
    id: 'orders',
    path: '../orders/orders.module',
    exportName: 'OrdersModule',
  },
  {
    id: 'warehouse',
    path: '../warehouse/warehouse.module',
    exportName: 'WarehouseModule',
  },
];

export function loadOptionalModules(
  activeModules: readonly string[],
  loadModule: (path: string) => Record<string, Type<unknown>> = requireModule,
): Type<unknown>[] {
  return optionalModules
    .filter(({ id }) => activeModules.includes(id))
    .map(({ path, exportName }) => loadModule(path)[exportName]);
}
