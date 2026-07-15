const equipmentEditorRoles = new Set(['admin', 'chief_engineer', 'engineer']);
const equipmentEventsManagerRoles = new Set(['admin', 'chief_engineer']);

export function canEditEquipment(role: string | null | undefined) {
  return Boolean(role && equipmentEditorRoles.has(role));
}

export const canCreateEquipment = canEditEquipment;

export function canManageEquipmentEvents(role: string | null | undefined) {
  return Boolean(role && equipmentEventsManagerRoles.has(role));
}
