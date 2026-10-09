import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PpeAuditService } from './ppe-audit.service';
import { ppeNotFound } from './ppe.errors';
import { badPpeRequest, parseEmployeeSizes } from './ppe.validation';

const employeeSelect = {
  id: true,
  lastName: true,
  firstName: true,
  middleName: true,
  positionId: true,
  position: { select: { name: true } },
  clothingSize: true,
  clothingHeight: true,
  shoeSize: true,
  gloveSize: true,
  headwearSize: true,
  isActive: true,
} satisfies Prisma.EmployeeSelect;

type PpeEmployee = Prisma.EmployeeGetPayload<{ select: typeof employeeSelect }>;

function toPpeEmployee(employee: PpeEmployee) {
  return {
    ...employee,
    position: employee.position.name,
    shoeSize: employee.shoeSize?.toNumber() ?? null,
  };
}

const sizeLabels = {
  clothingSize: 'Размер одежды',
  clothingHeight: 'Ростовка одежды',
  shoeSize: 'Размер обуви',
  gloveSize: 'Размер перчаток',
  headwearSize: 'Размер головного убора',
};

@Injectable()
export class PpeEmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PpeAuditService,
  ) {}

  async list() {
    const employees = await this.prisma.employee.findMany({
      select: employeeSelect,
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' },
        { middleName: 'asc' },
      ],
    });
    return employees.map(toPpeEmployee);
  }

  async findOne(id: number) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      select: employeeSelect,
    });
    if (!employee) ppeNotFound('EMPLOYEE_NOT_FOUND');
    return toPpeEmployee(employee);
  }

  listPositions() {
    return this.prisma.position.findMany({
      select: { id: true, name: true, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async updateSizes(id: number, payload: unknown, actorUserId: string) {
    const data = parseEmployeeSizes(payload);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM employees WHERE id = ${id} FOR UPDATE`;
      const previous = await tx.employee.findUnique({
        where: { id },
        select: employeeSelect,
      });
      if (!previous) ppeNotFound('EMPLOYEE_NOT_FOUND');
      if (!previous.isActive)
        badPpeRequest(
          'EMPLOYEE_INACTIVE',
          'Нельзя менять размеры отключённого сотрудника.',
        );
      const employee = await tx.employee.update({
        where: { id },
        data,
        select: employeeSelect,
      });
      const result = toPpeEmployee(employee);
      await this.audit.writeChanges({
        action: AuditAction.UPDATE,
        entityType: 'employee',
        entityId: id,
        actorUserId,
        previous: toPpeEmployee(previous),
        next: result,
        labels: sizeLabels,
        tx,
      });
      return result;
    });
  }
}
