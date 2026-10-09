jest.mock('../users-admin/users-admin-credential-account', () => ({
  hashUserPassword: jest.fn(),
  createCredentialAccount: jest.fn(),
}));

import { ForbiddenException } from '@nestjs/common';
import {
  createController,
  session,
  type SessionType,
} from './ppe.controller.spec-fixtures';
import { UsersAdminController } from '../users-admin/users-admin.controller';

describe('PPE specialist cannot use users-admin endpoints', () => {
  const adminOperations: Array<{
    name: string;
    invoke: (c: UsersAdminController, s: SessionType) => unknown;
  }> = [
    { name: 'create employee', invoke: (c, s) => c.createEmployee({}, s) },
    {
      name: 'edit employee name or position',
      invoke: (c, s) => c.updateEmployee(1, {}, s),
    },
    {
      name: 'toggle employee status',
      invoke: (c, s) => c.setEmployeeStatus(1, false, s),
    },
    {
      name: 'list full employee records',
      invoke: (c, s) => c.listEmployees(s),
    },
    { name: 'list accounts', invoke: (c, s) => c.listUsers(s) },
    { name: 'create account', invoke: (c, s) => c.createUser({}, s) },
    {
      name: 'change account or role',
      invoke: (c, s) => c.updateUser('user', {}, s),
    },
    {
      name: 'block account',
      invoke: (c, s) => c.setUserStatus('user', true, s),
    },
    {
      name: 'change password',
      invoke: (c, s) => c.setUserPassword('user', {}, s),
    },
    { name: 'create position', invoke: (c, s) => c.createPosition({}, s) },
    { name: 'rename position', invoke: (c, s) => c.updatePosition(1, {}, s) },
    {
      name: 'toggle position status',
      invoke: (c, s) => c.setPositionStatus(1, false, s),
    },
  ];
  it.each(adminOperations)('denies $name', ({ invoke }) => {
    const controller = new UsersAdminController(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    expect(() => invoke(controller, session('ppe_specialist'))).toThrow(
      ForbiddenException,
    );
  });

  it('passes the authenticated actor to size updates', async () => {
    const { controller, employees } = createController();
    await controller.updateEmployeeSizes(
      1,
      { shoeSize: 42.5 },
      session('ppe_specialist'),
    );
    expect(employees.updateSizes).toHaveBeenCalledWith(
      1,
      { shoeSize: 42.5 },
      'ppe-actor',
    );
  });
});
