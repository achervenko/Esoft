import { getEffectiveUserRoles } from './role-module-policy';
import { ForbiddenException } from '@nestjs/common';
import { getPermissionRoles, hasPermission } from './permission-policy';

export function canReadEquipment(role: unknown) {
  return hasPermission(role, 'equipment.read');
}

export function getEquipmentResponsibleRoles(
  activeModules: readonly string[],
): string[] {
  if (!activeModules.includes('equipment')) return [];
  return getPermissionRoles('equipment.read').filter(
    (role) =>
      role !== 'admin' && getEffectiveUserRoles(role, activeModules).length > 0,
  );
}

export function canBackdatePpeIssue(role: unknown) {
  return hasPermission(role, 'ppe.issue.backdate');
}

export function canReadPpe(role: unknown) {
  return hasPermission(role, 'ppe.read');
}

export function assertCanViewUserProfile(params: {
  currentUserId: string;
  requestedUserId: string;
  role: unknown;
}) {
  if (
    params.currentUserId === params.requestedUserId ||
    hasPermission(params.role, 'users.manage')
  ) {
    return;
  }

  throwForbidden('Недостаточно прав для просмотра профиля пользователя.');
}

export function canViewEvents(role: unknown) {
  return hasPermission(role, 'events.read');
}

function throwForbidden(message: string): never {
  throw new ForbiddenException({
    code: 'FORBIDDEN',
    message,
  });
}
