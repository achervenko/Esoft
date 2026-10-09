import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function ppeNotFound(code: string): never {
  throw new NotFoundException({ code, message: 'Запись не найдена.' });
}

export function rethrowPpeError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const target: unknown = error.meta?.target;
      if (
        target === 'uq_ppe_items_article' ||
        (Array.isArray(target) &&
          target.length === 1 &&
          target[0] === 'article')
      ) {
        throw new ConflictException({
          code: 'PPE_ITEM_ARTICLE_CONFLICT',
          message: 'СИЗ с таким артикулом уже существует.',
        });
      }
      if (
        target === 'uq_ppe_item_sizes_item_value' ||
        (Array.isArray(target) &&
          (target.length === 2 ||
            (target.length === 3 &&
              (target.includes('height_value') ||
                target.includes('heightValue')))) &&
          target.includes('value') &&
          (target.includes('ppe_item_id') || target.includes('ppeItemId')))
      ) {
        throw new ConflictException({
          code: 'PPE_ITEM_SIZE_CONFLICT',
          message: 'Такой размер уже существует у этой позиции СИЗ.',
        });
      }
      throw new ConflictException({
        code: 'PPE_ALREADY_EXISTS',
        message: 'Запись с такими уникальными значениями уже существует.',
      });
    }
    if (error.code === 'P2025') ppeNotFound('PPE_NOT_FOUND');
  }
  throw error;
}
