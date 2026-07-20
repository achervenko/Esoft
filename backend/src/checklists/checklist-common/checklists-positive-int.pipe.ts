import {
  BadRequestException,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';

@Injectable()
export class ParseChecklistPositiveIntPipe implements PipeTransform {
  transform(value: unknown) {
    const parsedValue =
      typeof value === 'number'
        ? value
        : typeof value === 'string' && value.trim()
          ? Number(value)
          : NaN;

    if (!Number.isSafeInteger(parsedValue) || parsedValue <= 0) {
      throw new BadRequestException({
        code: 'ROUTE_ID_INVALID',
        message: 'Некорректный идентификатор.',
      });
    }

    return parsedValue;
  }
}
