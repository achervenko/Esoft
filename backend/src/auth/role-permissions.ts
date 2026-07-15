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

export function assertCanManageFiles(role: unknown) {
  if (!role || !rolesAllowedToManageFiles.has(String(role))) {
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message:
        '\u041d\u0435\u0434\u043e\u0441\u0442\u0430\u0442\u043e\u0447\u043d\u043e \u043f\u0440\u0430\u0432 \u0434\u043b\u044f \u0440\u0430\u0431\u043e\u0442\u044b \u0441 \u0444\u0430\u0439\u043b\u0430\u043c\u0438.',
    });
  }
}

export function assertAdmin(role: unknown) {
  if (String(role) !== 'admin') {
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message:
        '\u041d\u0435\u0434\u043e\u0441\u0442\u0430\u0442\u043e\u0447\u043d\u043e \u043f\u0440\u0430\u0432 \u0434\u043b\u044f \u0443\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u044f \u0443\u0447\u0451\u0442\u043d\u044b\u043c\u0438 \u0437\u0430\u043f\u0438\u0441\u044f\u043c\u0438.',
    });
  }
}

export function assertCanEditEquipment(role: unknown) {
  if (!role || !rolesAllowedToManageFiles.has(String(role))) {
    throw new ForbiddenException('Недостаточно прав для редактирования.');
  }
}

export function assertCanManageEquipmentEvents(role: unknown) {
  if (!role || !rolesAllowedToManageEquipmentEvents.has(String(role))) {
    throw new ForbiddenException({
      code: 'FORBIDDEN',
      message: 'Недостаточно прав для управления событиями оборудования.',
    });
  }
}
