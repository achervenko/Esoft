import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Injectable()
export class EquipmentReferenceValidatorService {
  async assertEquipmentModelExists(
    tx: Prisma.TransactionClient,
    modelId: number,
  ) {
    const models = await tx.$queryRaw<
      Array<{
        id: number;
      }>
    >`
      SELECT
        em.id
      FROM equipment_models em
      WHERE em.id = ${modelId}
      FOR SHARE OF em
    `;
    const model = models[0];

    if (!model) {
      throw new BadRequestException('Выберите модель из списка.');
    }
  }

  async assertResponsibleEmployeeIsActive(
    tx: Prisma.TransactionClient,
    employeeId: number | null | undefined,
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

    if (!employee || !employee.is_active) {
      throw new BadRequestException({
        code: 'RESPONSIBLE_EMPLOYEE_INACTIVE',
        message: 'Выбранный ответственный сотрудник не найден или отключён.',
      });
    }
  }

  async assertSectionExists(
    tx: Prisma.TransactionClient,
    sectionId: number,
  ) {
    const section = await tx.section.findUnique({
      where: { id: sectionId },
      select: { id: true },
    });

    if (!section) {
      throw new BadRequestException('Выберите местонахождение из списка.');
    }
  }

  async assertCountryExists(
    tx: Prisma.TransactionClient,
    countryId: number | null,
  ) {
    if (countryId == null) {
      return;
    }

    const country = await tx.country.findUnique({
      where: { id: countryId },
      select: { id: true },
    });

    if (!country) {
      throw new BadRequestException('Выберите страну производства из списка.');
    }
  }
}
