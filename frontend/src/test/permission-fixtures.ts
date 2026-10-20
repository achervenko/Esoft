// API response fixtures for UI tests only. Runtime permissions always come from backend.
const grants: Record<string, readonly string[]> = {
  "admin": [
    "users.profile.read",
    "equipment.read",
    "files.read",
    "equipment.maintenance-types.read",
    "equipment.progress.read",
    "checklists.work",
    "search.read",
    "equipment.edit",
    "files.manage",
    "events.read",
    "calendar.read",
    "equipment.events.manage",
    "equipment.maintenance-types.manage",
    "events.manage",
    "calendar.manage",
    "checklists.manage",
    "users.manage",
    "dictionaries.manage",
    "search.manage",
    "ppe.read",
    "ppe.catalog.manage",
    "ppe.employee-sizes.manage",
    "ppe.norms.manage",
    "ppe.issue",
    "ppe.issue.backdate",
    "warehouse.catalog.manage",
    "warehouse.adjustments.manage"
  ],
  "chief_engineer": [
    "users.profile.read",
    "equipment.read",
    "files.read",
    "equipment.maintenance-types.read",
    "equipment.progress.read",
    "checklists.work",
    "search.read",
    "equipment.edit",
    "files.manage",
    "events.read",
    "calendar.read",
    "equipment.events.manage",
    "events.manage",
    "checklists.manage"
  ],
  "engineer": [
    "users.profile.read",
    "equipment.read",
    "files.read",
    "equipment.maintenance-types.read",
    "equipment.progress.read",
    "checklists.work",
    "search.read",
    "equipment.edit",
    "files.manage",
    "events.read",
    "calendar.read"
  ],
  "operator": [
    "users.profile.read",
    "equipment.read",
    "files.read",
    "equipment.maintenance-types.read",
    "equipment.progress.read",
    "checklists.work",
    "search.read"
  ],
  "auditor": [
    "users.profile.read",
    "equipment.read",
    "files.read",
    "equipment.maintenance-types.read",
    "equipment.progress.read",
    "checklists.work",
    "search.read"
  ],
  "ppe_specialist": [
    "users.profile.read",
    "ppe.read",
    "ppe.employee-sizes.manage",
    "ppe.norms.manage",
    "search.read"
  ],
  "accounting_specialist": [
    "users.profile.read",
    "ppe.read",
    "ppe.catalog.manage",
    "ppe.issue",
    "search.read"
  ],
  "storekeeper": [
    "warehouse.catalog.manage",
    "users.profile.read"
  ]
};
export function permissionsForTest(role: unknown): string[] {
 if (typeof role !== 'string') return [];
 return [...new Set(role.split(',').flatMap(value => grants[value.trim()] ?? []))];
}
