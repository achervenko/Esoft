import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

export function throwEquipmentEventBadRequest(
  code: string,
  message: string,
): never {
  throw new BadRequestException({ code, message });
}

export function throwEquipmentEventConflict(
  code: string,
  message: string,
): never {
  throw new ConflictException({ code, message });
}

export function throwEquipmentEventForbidden(
  code: string,
  message: string,
): never {
  throw new ForbiddenException({ code, message });
}

export function throwEquipmentEventNotFound(
  code: string,
  message: string,
): never {
  throw new NotFoundException({ code, message });
}
