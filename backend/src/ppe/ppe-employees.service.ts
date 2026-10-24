import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PpeAuditService } from './ppe-audit.service';
import { ppeNotFound } from './ppe.errors';
import { badPpeRequest, parseEmployeeSizes } from './ppe.validation';
import { employeeSizesSelect } from './ppe-employee-sizes';

const employeeSelect = {
  id: true,
  gender: true,
  lastName: true,
  firstName: true,
  middleName: true,
  positionId: true,
  positionAssignedAt: true,
  position: { select: { name: true } },
  additionalPositions: { include: { position: { select: { name: true } } } },
  ppeSizes: { select: employeeSizesSelect },
  isActive: true,
} satisfies Prisma.EmployeeSelect;

type PpeEmployee = Prisma.EmployeeGetPayload<{ select: typeof employeeSelect }>;

function toPpeEmployee(employee: PpeEmployee) {
  const { additionalPositions, positionAssignedAt, ...rest } = employee;
  return {
    ...rest,
    positionAssignments: [
      {
        positionId: employee.positionId,
        assignedAt: positionAssignedAt?.toISOString().slice(0, 10) ?? null,
      },
      ...additionalPositions.map(({ positionId, assignedAt }) => ({
        positionId,
        assignedAt: assignedAt.toISOString().slice(0, 10),
      })),
    ],
    position: [
      employee.position.name,
      ...additionalPositions.map(({ position }) => position.name),
    ].join(', '),
    ppeSizes: employee.ppeSizes
      ? {
          ...employee.ppeSizes,
          shoeSize: employee.ppeSizes.shoeSize?.toNumber() ?? null,
        }
      : null,
  };
}

const sizeLabels = {
  clothingSize: 'Размер одежды',
  clothingHeight: 'Ростовка одежды',
  tshirtSize: 'Размер футболки',
  tshirtHeight: 'Ростовка футболки',
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
      const ppeSizes = await tx.ppeEmployeeSizes.upsert({
        where: { employeeId: id },
        create: { employeeId: id, ...data },
        update: data,
        select: employeeSizesSelect,
      });
      const result = toPpeEmployee({ ...previous, ppeSizes });
      await this.audit.writeChanges({
        action: AuditAction.UPDATE,
        entityType: 'employee',
        entityId: id,
        actorUserId,
        previous:
          toPpeEmployee(previous).ppeSizes ??
          Object.fromEntries(Object.keys(sizeLabels).map((key) => [key, null])),
        next: result.ppeSizes!,
        labels: sizeLabels,
        tx,
      });
      return result;
    });
  }
}
