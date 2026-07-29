import { ForbiddenException } from '@nestjs/common';

const ROLE_PERMISSIONS = {
  calendar: {
    access: ['admin'],
  },
  checklists: {
    manage: ['admin', 'chief_engineer'],
  },
  equipment: {
    edit: ['admin', 'chief_engineer', 'engineer'],
  },
  equipmentEvents: {
    manage: ['admin', 'chief_engineer'],
  },
  events: {
    manage: ['admin', 'chief_engineer'],
    view: ['admin', 'chief_engineer', 'engineer'],
  },
  files: {
    manage: ['admin', 'chief_engineer', 'engineer'],
  },
  users: {
    manage: ['admin'],
  },
} as const;

type PermissionRoles = readonly string[];

export function assertCanManageFiles(role: unknown) {
  assertPermission(
    role,
    ROLE_PERMISSIONS.files.manage,
    'Недостаточно прав для работы с файлами.',
  );
}

export function assertCanViewUserProfile(params: {
  currentUserId: string;
  requestedUserId: string;
  role: unknown;
}) {
  if (
    params.currentUserId === params.requestedUserId ||
    isKnownRole(params.role, ROLE_PERMISSIONS.users.manage)
  ) {
    return;
  }

  throwForbidden('Недостаточно прав для просмотра профиля пользователя.');
}

export function assertAdmin(role: unknown) {
  assertPermission(
    role,
    ROLE_PERMISSIONS.users.manage,
    'Недостаточно прав для управления учётными записями.',
  );
}

export function assertCanEditEquipment(role: unknown) {
  assertPermission(
    role,
    ROLE_PERMISSIONS.equipment.edit,
    'Недостаточно прав для редактирования оборудования.',
  );
}

export function assertCanManageEquipmentEvents(role: unknown) {
  assertPermission(
    role,
    ROLE_PERMISSIONS.equipmentEvents.manage,
    'Недостаточно прав для управления событиями оборудования.',
  );
}

export function assertCanManageEvents(role: unknown) {
  assertPermission(
    role,
    ROLE_PERMISSIONS.events.manage,
    'Недостаточно прав для управления событиями.',
  );
}

export function assertCanViewEvents(role: unknown) {
  assertPermission(
    role,
    ROLE_PERMISSIONS.events.view,
    'Недостаточно прав для просмотра событий.',
  );
}

export function assertCanAccessCalendar(role: unknown) {
  assertPermission(
    role,
    ROLE_PERMISSIONS.calendar.access,
    'Недостаточно прав для работы с календарем.',
  );
}

export function assertCanManageChecklists(role: unknown) {
  assertPermission(
    role,
    ROLE_PERMISSIONS.checklists.manage,
    'Недостаточно прав для управления чек-листами.',
  );
}

function assertPermission(
  role: unknown,
  allowedRoles: PermissionRoles,
  message: string,
) {
  if (!isKnownRole(role, allowedRoles)) {
    throwForbidden(message);
  }
}

function throwForbidden(message: string): never {
  throw new ForbiddenException({
    code: 'FORBIDDEN',
    message,
  });
}

function isKnownRole(role: unknown, allowedRoles: PermissionRoles) {
  return typeof role === 'string' && allowedRoles.includes(role);
}
