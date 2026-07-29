import {
  BadRequestException,
  ConflictException,
  type HttpException,
  NotFoundException,
} from '@nestjs/common';

type CalendarExceptionConstructor = new (response: {
  code: string;
  message: string;
}) => HttpException;

export function throwCalendarBadRequest(code: string, message: string): never {
  throwCalendarException(BadRequestException, code, message);
}

export function throwCalendarConflict(code: string, message: string): never {
  throwCalendarException(ConflictException, code, message);
}

export function throwCalendarNotFound(code: string, message: string): never {
  throwCalendarException(NotFoundException, code, message);
}

function throwCalendarException(
  Exception: CalendarExceptionConstructor,
  code: string,
  message: string,
): never {
  throw new Exception({ code, message });
}
