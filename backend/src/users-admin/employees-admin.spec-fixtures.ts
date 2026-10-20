import { EmployeePositionAssignmentsService } from './employee-position-assignments.service';
import { EmployeesAdminStatusService } from './employees-admin-status.service';
import { EmployeesAdminEditorService } from './employees-admin-editor.service';
import { EmployeesAdminService } from './employees-admin.service';

export const baseEmployee = {
  gender: 'MALE',
  additionalPositions: [],
  _count: {
    employeeUsers: 0,
    responsibleEquipment: 0,
  },
  employeeUsers: [],
  firstName: 'Иван',
  id: 1,
  isActive: true,
  lastName: 'Иванов',
  middleName: 'Иванович',
  position: { name: 'Инженер' },
  positionId: 1,
};

export function createService() {
  const tx = {
    $queryRaw: jest.fn(),
    employee: {
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    session: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    user: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
  const prisma = {
    $transaction: jest.fn((operation: (transaction: typeof tx) => unknown) =>
      operation(tx),
    ),
  };
  const audit = {
    logEmployeeCreated: jest.fn(),
    logEmployeeStatusChanged: jest.fn().mockResolvedValue(undefined),
    logEmployeeUpdated: jest.fn(),
    logUserAutoDisabledForEmployee: jest.fn().mockResolvedValue(undefined),
  };
  const service = new EmployeesAdminService(
    prisma as never,
    new EmployeesAdminEditorService(
      audit as never,
      prisma as never,
      new EmployeePositionAssignmentsService(),
    ),
    new EmployeesAdminStatusService(audit as never, prisma as never),
  );

  return { audit, prisma, service, tx };
}

export const payload = {
  gender: 'MALE' as const,
  firstName: 'Иван',
  lastName: 'Иванов',
  positionId: 1,
};
