import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  throwIfEquipmentUniqueConflict,
  throwInventoryNumberConflict,
  throwVisibleIdConflict,
} from './equipment-write.errors';

describe('equipment write errors', () => {
  it('throws visible id conflict', () => {
    expectConflictCode(() => throwVisibleIdConflict()).toBe(
      'EQUIPMENT_ID_ALREADY_EXISTS',
    );
  });

  it('throws inventory number conflict', () => {
    expectConflictCode(() => throwInventoryNumberConflict()).toBe(
      'EQUIPMENT_INVENTORY_NUMBER_ALREADY_EXISTS',
    );
  });

  it('maps P2002 visible id conflicts', () => {
    expectConflictCode(() =>
      throwIfEquipmentUniqueConflict(
        new Prisma.PrismaClientKnownRequestError('duplicate', {
          clientVersion: 'test',
          code: 'P2002',
          meta: { target: ['visible_id'] },
        }),
      ),
    ).toBe('EQUIPMENT_ID_ALREADY_EXISTS');
  });

  it('maps P2002 inventory number conflicts', () => {
    expectConflictCode(() =>
      throwIfEquipmentUniqueConflict(
        new Prisma.PrismaClientKnownRequestError('duplicate', {
          clientVersion: 'test',
          code: 'P2002',
          meta: { target: 'equipment_inventory_number_key' },
        }),
      ),
    ).toBe('EQUIPMENT_INVENTORY_NUMBER_ALREADY_EXISTS');
  });

  it('ignores P2002 conflicts with an unrelated target', () => {
    expect(() =>
      throwIfEquipmentUniqueConflict(
        new Prisma.PrismaClientKnownRequestError('duplicate', {
          clientVersion: 'test',
          code: 'P2002',
          meta: { target: ['some_other_unique_key'] },
        }),
      ),
    ).not.toThrow();
  });

  it('ignores unrelated Prisma errors', () => {
    expect(() =>
      throwIfEquipmentUniqueConflict(
        new Prisma.PrismaClientKnownRequestError('other', {
          clientVersion: 'test',
          code: 'P2003',
        }),
      ),
    ).not.toThrow();
  });

  it('ignores non-Prisma errors', () => {
    expect(() => throwIfEquipmentUniqueConflict(new Error('boom'))).not.toThrow();
  });
});

function expectConflictCode(action: () => unknown) {
  try {
    action();
  } catch (error) {
    if (error instanceof ConflictException) {
      const response = error.getResponse();

      if (
        response &&
        typeof response === 'object' &&
        'code' in response &&
        typeof response.code === 'string'
      ) {
        return expect(response.code);
      }
    }

    throw error;
  }

  throw new Error('Expected ConflictException to be thrown.');
}
