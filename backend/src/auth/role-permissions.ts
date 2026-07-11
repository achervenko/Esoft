import { ForbiddenException } from '@nestjs/common';

const rolesAllowedToManageFiles = new Set([
  'admin',
  'chief_engineer',
  'engineer',
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

export function assertCanEditEquipment(role: unknown) {
  if (!role || !rolesAllowedToManageFiles.has(String(role))) {
    throw new ForbiddenException('Недостаточно прав для редактирования.');
  }
}
