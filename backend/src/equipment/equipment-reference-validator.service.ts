import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Injectable()
export class EquipmentReferenceValidatorService {
  async assertEquipmentModelExists(
    tx: Prisma.TransactionClient,
    modelId: number,
    currentModelId?: number,
  ) {
    const models = await tx.$queryRaw<
      Array<{
        id: number;
        is_active: boolean;
      }>
    >`
      SELECT
        em.id, (em.is_active AND m.is_active) AS is_active
      FROM equipment_models em
      JOIN manufacturers m ON m.id = em.manufacturer_id
      WHERE em.id = ${modelId}
      FOR SHARE OF em, m
    `;
    const model = models[0];

    if (!model || (!model.is_active && modelId !== currentModelId)) {
      throw new BadRequestException('Выберите модель из списка.');
    }
  }

  async assertResponsibleEmployeeIsActive(
    tx: Prisma.TransactionClient,
    employeeId: number | null | undefined,
    currentEmployeeId?: number,
  ) {
    if (employeeId == null) {
      return;
    }

    const employees = await tx.$queryRaw<
      Array<{ id: number; is_active: boolean }>
    >`
      SELECT id, is_active
      FROM employees
      WHERE id = ${employeeId}
      FOR SHARE
    `;
    const employee = employees[0];

    if (
      !employee ||
      (!employee.is_active && employeeId !== currentEmployeeId)
    ) {
      throw new BadRequestException({
        code: 'RESPONSIBLE_EMPLOYEE_INACTIVE',
        message: 'Выбранный ответственный сотрудник не найден или отключён.',
      });
    }
  }

  async assertSectionExists(
    tx: Prisma.TransactionClient,
    sectionId: number,
    currentSectionId?: number,
  ) {
    const rows = await tx.$queryRaw<Array<{ id: number; is_active: boolean }>>`
      SELECT s.id, (s.is_active AND w.is_active) AS is_active
      FROM sections s JOIN workshops w ON w.id = s.workshop_id
      WHERE s.id = ${sectionId} FOR SHARE OF s, w
    `;
    if (!rows[0] || (!rows[0].is_active && sectionId !== currentSectionId)) {
      throw new BadRequestException('Выберите местонахождение из списка.');
    }
  }

  async assertCountryExists(
    tx: Prisma.TransactionClient,
    countryId: number | null,
    currentCountryId?: number | null,
  ) {
    if (countryId == null) return;
    const rows = await tx.$queryRaw<Array<{ id: number; is_active: boolean }>>`
      SELECT id, is_active FROM countries WHERE id = ${countryId} FOR SHARE
    `;
    if (!rows[0] || (!rows[0].is_active && countryId !== currentCountryId)) {
      throw new BadRequestException('Выберите страну производства из списка.');
    }
  }
}
