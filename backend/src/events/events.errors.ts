import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

export function throwEventBadRequest(code: string, message: string): never {
  throw new BadRequestException({ code, message });
}

export function throwEventConflict(code: string, message: string): never {
  throw new ConflictException({ code, message });
}

export function throwEventForbidden(code: string, message: string): never {
  throw new ForbiddenException({ code, message });
}

export function throwEventNotFound(code: string, message: string): never {
  throw new NotFoundException({ code, message });
}
