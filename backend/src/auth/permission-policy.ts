import {
  getEffectiveUserRoles,
  getUserRoles,
  type AppRole,
} from './role-module-policy';
import optionalModuleIds from '../../prisma/module-catalog.json';

// Modules declare their actions; auth binds those action IDs to roles.
// String bindings avoid importing optional module implementation files into auth.
const equipmentReader = [
  'users.profile.read',
  'equipment.read',
  'files.read',
  'equipment.maintenance-types.read',
  'equipment.progress.read',
  'checklists.work',
  'search.read',
] as const;
const equipmentEditor = [
  ...equipmentReader,
  'equipment.edit',
  'files.manage',
  'events.read',
  'calendar.read',
] as const;

export const ROLE_PERMISSIONS = {
  admin: [
    ...equipmentEditor,
    'equipment.events.manage',
    'equipment.maintenance-types.manage',
    'events.manage',
    'calendar.manage',
    'checklists.manage',
    'users.manage',
    'dictionaries.manage',
    'search.manage',
    'ppe.read',
    'ppe.catalog.manage',
    'ppe.employee-sizes.manage',
    'ppe.norms.manage',
    'ppe.issue',
    'ppe.issue.backdate',
    'warehouse.transfers.read',
    'warehouse.transfers.manage',
    'warehouse.receipts.read',
    'warehouse.receipts.manage',
    'warehouse.catalog.manage',
    'warehouse.projects.read',
    'warehouse.reservations.manage',
    'warehouse.stock.read',
    'warehouse.storage-locations.read',
    'warehouse.storage-locations.manage',
    'warehouse.adjustments.manage',
    'warehouse.issues.manage',
    'warehouse.reservations.override',
    'warehouse.issue-sheets.manage',
  ],
  chief_engineer: [
    ...equipmentEditor,
    'equipment.events.manage',
    'events.manage',
    'checklists.manage',
  ],
  engineer: equipmentEditor,
  operator: equipmentReader,
  auditor: equipmentReader,
  ppe_specialist: [
    'users.profile.read',
    'ppe.read',
    'ppe.employee-sizes.manage',
    'ppe.norms.manage',
    'search.read',
  ],
  accounting_specialist: [
    'users.profile.read',
    'ppe.read',
    'ppe.catalog.manage',
    'ppe.issue',
    'search.read',
  ],
  storekeeper: [
    'warehouse.transfers.read',
    'warehouse.transfers.manage',
    'warehouse.receipts.read',
    'warehouse.receipts.manage',
    'warehouse.catalog.manage',
    'warehouse.projects.read',
    'warehouse.reservations.manage',
    'warehouse.stock.read',
    'warehouse.storage-locations.read',
    'warehouse.storage-locations.manage',
    'warehouse.issue-sheets.manage',
    'warehouse.issues.manage',
    'users.profile.read',
  ],
} as const satisfies Record<AppRole, readonly string[]>;

type RolePermission = (typeof ROLE_PERMISSIONS)[AppRole][number];
export type Permission = RolePermission;
const knownPermissions = new Set<string>([
  ...Object.values(ROLE_PERMISSIONS).flat(),
]);

export function isPermission(value: unknown): value is Permission {
  return typeof value === 'string' && knownPermissions.has(value);
}

export function getUserPermissions(
  role: unknown,
  activeModules?: readonly string[],
): Permission[] {
  const roles =
    activeModules === undefined
      ? getUserRoles(role)
      : getEffectiveUserRoles(role, activeModules);
  const permissions = [
    ...new Set(roles.flatMap((value) => [...ROLE_PERMISSIONS[value]])),
  ];
  if (activeModules === undefined) return permissions;
  return permissions.filter((permission) => {
    const module = optionalModuleIds.find((id) =>
      permission.startsWith(`${id}.`),
    );
    return !module || activeModules.includes(module);
  });
}

export function hasPermission(role: unknown, permission: Permission) {
  return getUserPermissions(role).includes(permission);
}

export function getPermissionRoles(permission: Permission): AppRole[] {
  return (Object.keys(ROLE_PERMISSIONS) as AppRole[]).filter((role) =>
    hasPermission(role, permission),
  );
}
