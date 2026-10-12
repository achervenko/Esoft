import { getEquipmentResponsibleRoles } from '../auth/role-permissions';

// Derived from equipment access, with the administrator exception applied centrally.
export const EQUIPMENT_RESPONSIBLE_ROLES = getEquipmentResponsibleRoles();
