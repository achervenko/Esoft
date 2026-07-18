import { ForbiddenException } from '@nestjs/common';

const rolesAllowedToManageFiles = new Set([
  'admin',
  'chief_engineer',
  'engineer',
]);

const rolesAllowedToManageEquipmentEvents = new Set([
  'admin',
  'chief_engineer',
]);

const rolesAllowedToManageChecklists = new Set(['admin', 'chief_engineer']);

export function assertCanManageFiles(role: unknown) {
  if (!isKnownRole(role, rolesAllowedToManageFiles)) {
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'Недостаточно прав для работы с файлами.',
    });
  }
}

export function assertAdmin(role: unknown) {
  if (role !== 'admin') {
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'Недостаточно прав для управления учётными записями.',
    });
  }
}

export function assertCanEditEquipment(role: unknown) {
  if (!isKnownRole(role, rolesAllowedToManageFiles)) {
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'Недостаточно прав для редактирования оборудования.',
    });
  }
}

export function assertCanManageEquipmentEvents(role: unknown) {
  if (!isKnownRole(role, rolesAllowedToManageEquipmentEvents)) {
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'Недостаточно прав для управления событиями оборудования.',
    });
  }
}

export function assertCanManageChecklists(role: unknown) {
  if (!isKnownRole(role, rolesAllowedToManageChecklists)) {
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'Недостаточно прав для управления чек-листами.',
    });
  }
}

function isKnownRole(role: unknown, allowedRoles: ReadonlySet<string>) {
  return typeof role === 'string' && allowedRoles.has(role);
}
