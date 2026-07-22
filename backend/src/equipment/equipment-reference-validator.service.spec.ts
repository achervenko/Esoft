import { BadRequestException } from '@nestjs/common';
import { EquipmentReferenceValidatorService } from './equipment-reference-validator.service';

describe('EquipmentReferenceValidatorService', () => {
  let service: EquipmentReferenceValidatorService;

  beforeEach(() => {
    service = new EquipmentReferenceValidatorService();
  });

  it('accepts an existing equipment model', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 10 }]),
    } as never;

    await expect(service.assertEquipmentModelExists(tx, 10)).resolves.toBeUndefined();
  });

  it('rejects a missing equipment model', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
    } as never;

    expect(
      await expectBadRequestMessage(() =>
        service.assertEquipmentModelExists(tx, 10),
      ),
    ).toBe('Выберите модель из списка.');
  });

  it('accepts an active responsible employee', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 7, is_active: true }]),
    } as never;

    await expect(
      service.assertResponsibleEmployeeIsActive(tx, 7),
    ).resolves.toBeUndefined();
  });

  it('rejects a missing responsible employee', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
    } as never;

    expect(
      await expectBadRequestCode(() =>
        service.assertResponsibleEmployeeIsActive(tx, 7),
      ),
    ).toBe('RESPONSIBLE_EMPLOYEE_INACTIVE');
  });

  it('rejects an inactive responsible employee', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 7, is_active: false }]),
    } as never;

    expect(
      await expectBadRequestCode(() =>
        service.assertResponsibleEmployeeIsActive(tx, 7),
      ),
    ).toBe('RESPONSIBLE_EMPLOYEE_INACTIVE');
  });

  it('skips employee validation when employeeId is nullish', async () => {
    const tx = {
      $queryRaw: jest.fn(),
    } as never;

    await expect(
      service.assertResponsibleEmployeeIsActive(tx, null),
    ).resolves.toBeUndefined();
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });

  it('validates section existence', async () => {
    const tx = {
      section: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    } as never;

    expect(
      await expectBadRequestMessage(() => service.assertSectionExists(tx, 3)),
    ).toBe('Выберите местонахождение из списка.');
  });

  it('accepts an existing section', async () => {
    const tx = {
      section: {
        findUnique: jest.fn().mockResolvedValue({ id: 3 }),
      },
    } as never;

    await expect(service.assertSectionExists(tx, 3)).resolves.toBeUndefined();
  });

  it('validates country existence only when countryId is provided', async () => {
    const tx = {
      country: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    } as never;

    expect(
      await expectBadRequestMessage(() => service.assertCountryExists(tx, 4)),
    ).toBe('Выберите страну производства из списка.');

    await expect(service.assertCountryExists(tx, null)).resolves.toBeUndefined();
  });

  it('accepts an existing country', async () => {
    const tx = {
      country: {
        findUnique: jest.fn().mockResolvedValue({ id: 4 }),
      },
    } as never;

    await expect(service.assertCountryExists(tx, 4)).resolves.toBeUndefined();
  });
});

async function expectBadRequestMessage(action: () => Promise<unknown>) {
  try {
    await action();
  } catch (error) {
    if (error instanceof BadRequestException) {
      return error.message;
    }

    throw error;
  }

  throw new Error('Expected BadRequestException to be thrown.');
}

async function expectBadRequestCode(action: () => Promise<unknown>) {
  try {
    await action();
  } catch (error) {
    if (error instanceof BadRequestException) {
      const response = error.getResponse();

      if (
        response &&
        typeof response === 'object' &&
        'code' in response &&
        typeof response.code === 'string'
      ) {
        return response.code;
      }
    }

    throw error;
  }

  throw new Error('Expected BadRequestException to be thrown.');
}
