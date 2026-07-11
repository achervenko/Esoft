import { ForbiddenException } from '@nestjs/common';

const rolesAllowedToManageFiles = new Set([
  'admin',
  'chief_engineer',
  'engineer',
]);

export function assertCanManageFiles(role: unknown) {
  if (!role || !rolesAllowedToManageFiles.has(String(role))) {
    throw new ForbiddenException('Недостаточно прав для работы с файлами.');
  }
}

export function assertCanEditEquipment(role: unknown) {
  if (!role || !rolesAllowedToManageFiles.has(String(role))) {
    throw new ForbiddenException('Недостаточно прав для редактирования.');
  }
}
