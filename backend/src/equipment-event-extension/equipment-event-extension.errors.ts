import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

export function throwEquipmentEventExtensionBadRequest(
  code: string,
  message: string,
): never {
  throw new BadRequestException({ code, message });
}

export function throwEquipmentEventExtensionConflict(
  code: string,
  message: string,
): never {
  throw new ConflictException({ code, message });
}

export function throwEquipmentEventExtensionNotFound(
  code: string,
  message: string,
): never {
  throw new NotFoundException({ code, message });
}
