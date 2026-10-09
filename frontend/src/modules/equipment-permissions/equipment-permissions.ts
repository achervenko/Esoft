const equipmentEditorRoles = new Set(["admin", "chief_engineer", "engineer"]);
const equipmentEventsManagerRoles = new Set(["admin", "chief_engineer"]);
const maintenanceSettingsManagerRoles = new Set(["admin", "chief_engineer"]);

export function canEditEquipment(role: string | null | undefined) {
  return Boolean(role && equipmentEditorRoles.has(role));
}

export const canCreateEquipment = canEditEquipment;

export function canManageEquipmentEvents(role: string | null | undefined) {
  return Boolean(role && equipmentEventsManagerRoles.has(role));
}

export function canManageMaintenanceSettings(role: string | null | undefined) {
  return Boolean(role && maintenanceSettingsManagerRoles.has(role));
}

const equipmentReaderRoles = new Set([
  "admin",
  "chief_engineer",
  "engineer",
  "operator",
  "auditor",
]);

export function canReadEquipment(role: unknown) {
  return typeof role === "string" && equipmentReaderRoles.has(role);
}

export const canDownloadEquipmentDocuments = canReadEquipment;
