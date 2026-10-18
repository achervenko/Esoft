import { BadRequestException } from '@nestjs/common';
import { EquipmentReferenceValidatorService } from './equipment-reference-validator.service';

describe('EquipmentReferenceValidatorService', () => {
  let service: EquipmentReferenceValidatorService;

  beforeEach(() => {
    service = new EquipmentReferenceValidatorService();
  });

  it('accepts an existing equipment model', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 10, is_active: true }]),
    } as never;

    await expect(
      service.assertEquipmentModelExists(tx, 10),
    ).resolves.toBeUndefined();
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

  it('rejects an active model with an inactive manufacturer and includes parent activity in the SQL', async () => {
    const queryRaw = jest
      .fn()
      .mockResolvedValue([{ id: 10, is_active: false }]);
    const tx = { $queryRaw: queryRaw } as never;

    await expect(
      service.assertEquipmentModelExists(tx, 10),
    ).rejects.toBeInstanceOf(BadRequestException);
    const [parts, modelId] = queryRaw.mock.calls[0] as [
      TemplateStringsArray,
      number,
    ];
    const sql = parts.join('?').replace(/\s+/g, ' ');
    expect(sql).toContain('JOIN manufacturers m ON m.id = em.manufacturer_id');
    expect(sql).toContain('(em.is_active AND m.is_active) AS is_active');
    expect(sql).toContain('FOR SHARE OF em, m');
    expect(modelId).toBe(10);
    await expect(
      service.assertEquipmentModelExists(tx, 10, 10),
    ).resolves.toBeUndefined();
  });

  it('rejects an active section with an inactive workshop and includes parent activity in the SQL', async () => {
    const queryRaw = jest
      .fn()
      .mockResolvedValue([{ id: 10, is_active: false }]);
    const tx = { $queryRaw: queryRaw } as never;

    await expect(service.assertSectionExists(tx, 10)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    const [parts, sectionId] = queryRaw.mock.calls[0] as [
      TemplateStringsArray,
      number,
    ];
    const sql = parts.join('?').replace(/\s+/g, ' ');
    expect(sql).toContain('JOIN workshops w ON w.id = s.workshop_id');
    expect(sql).toContain('(s.is_active AND w.is_active) AS is_active');
    expect(sql).toContain('FOR SHARE OF s, w');
    expect(sectionId).toBe(10);
    await expect(
      service.assertSectionExists(tx, 10, 10),
    ).resolves.toBeUndefined();
  });

  it.each(['model', 'section', 'country'] as const)(
    'rejects an inactive %s for new assignments but preserves the current relation',
    async (kind) => {
      const tx = {
        $queryRaw: jest.fn().mockResolvedValue([{ id: 10, is_active: false }]),
      } as never;
      const validate = (id: number, currentId?: number) => {
        if (kind === 'model')
          return service.assertEquipmentModelExists(tx, id, currentId);
        if (kind === 'section')
          return service.assertSectionExists(tx, id, currentId);
        return service.assertCountryExists(tx, id, currentId);
      };
      await expect(validate(10)).rejects.toBeInstanceOf(BadRequestException);
      await expect(validate(10, 10)).resolves.toBeUndefined();
      await expect(validate(10, 11)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    },
  );

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

  it('preserves an inactive current responsible employee but rejects a new assignment', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 7, is_active: false }]),
    } as never;
    await expect(
      service.assertResponsibleEmployeeIsActive(tx, 7, 7),
    ).resolves.toBeUndefined();
    await expect(
      service.assertResponsibleEmployeeIsActive(tx, 7, 8),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a missing employee even when it matches the current ID', async () => {
    const tx = { $queryRaw: jest.fn().mockResolvedValue([]) } as never;
    await expect(
      service.assertResponsibleEmployeeIsActive(tx, 7, 7),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('skips employee validation when employeeId is nullish', async () => {
    const tx = {
      $queryRaw: jest.fn(),
    };

    await expect(
      service.assertResponsibleEmployeeIsActive(tx as never, null),
    ).resolves.toBeUndefined();
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });

  it('validates section existence', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
    } as never;

    expect(
      await expectBadRequestMessage(() => service.assertSectionExists(tx, 3)),
    ).toBe('Выберите местонахождение из списка.');
  });

  it('accepts an existing section', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 3, is_active: true }]),
    } as never;

    await expect(service.assertSectionExists(tx, 3)).resolves.toBeUndefined();
  });

  it('validates country existence only when countryId is provided', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
    } as never;

    expect(
      await expectBadRequestMessage(() => service.assertCountryExists(tx, 4)),
    ).toBe('Выберите страну производства из списка.');

    await expect(
      service.assertCountryExists(tx, null),
    ).resolves.toBeUndefined();
  });

  it('accepts an existing country', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 4, is_active: true }]),
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
