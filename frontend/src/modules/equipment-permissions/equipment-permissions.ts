const equipmentEditorRoles = new Set(['admin', 'chief_engineer', 'engineer']);

export function canEditEquipment(role: string | null | undefined) {
  return Boolean(role && equipmentEditorRoles.has(role));
}

export const canCreateEquipment = canEditEquipment;
