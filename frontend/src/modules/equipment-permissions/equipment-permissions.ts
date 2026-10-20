import { hasPermission } from "../../shared/lib/permissions";

export function canEditEquipment(permissions: unknown) {
  return hasPermission(permissions, "equipment.edit");
}

export function canManageEquipmentEvents(permissions: unknown) {
  return hasPermission(permissions, "equipment.events.manage");
}

export function canManageMaintenanceSettings(permissions: unknown) {
  return hasPermission(permissions, "equipment.events.manage");
}

export function canReadEquipment(permissions: unknown) {
  return hasPermission(permissions, "equipment.read");
}

export function canDownloadEquipmentDocuments(permissions: unknown) {
  return hasPermission(permissions, "files.read") && canReadEquipment(permissions);
}

export function canManageEquipmentDocuments(permissions: unknown) {
  return hasPermission(permissions, "files.manage") && canEditEquipment(permissions);
}

export const canCreateEquipment = canEditEquipment;
