import { ForbiddenException } from '@nestjs/common';
import {
  createController,
  session,
  type SessionType,
} from './ppe.controller.spec-fixtures';
import type { PpeController } from './ppe.controller';
import * as rolePermissions from '../auth/role-permissions';

describe('PPE norm endpoint permission binding', () => {
  const normOperations = [
    {
      name: 'list',
      permission: 'assertCanReadPpe',
      invoke: (c: PpeController, s: SessionType) => c.listNorms({}, s),
    },
    {
      name: 'find one',
      permission: 'assertCanReadPpe',
      invoke: (c: PpeController, s: SessionType) => c.findNorm(1, s),
    },
    {
      name: 'find effective',
      permission: 'assertCanReadPpe',
      invoke: (c: PpeController, s: SessionType) =>
        c.findEffectiveNorm(1, {}, s),
    },
    {
      name: 'create',
      permission: 'assertCanManagePpeNorms',
      invoke: (c: PpeController, s: SessionType) => c.createNorm({}, s),
    },
    {
      name: 'revision',
      permission: 'assertCanManagePpeNorms',
      invoke: (c: PpeController, s: SessionType) =>
        c.createNormRevision(1, {}, s),
    },
    {
      name: 'update future',
      permission: 'assertCanManagePpeNorms',
      invoke: (c: PpeController, s: SessionType) =>
        c.updateFutureNorm(1, {}, s),
    },
  ] as const;

  function mockPermissions() {
    return {
      assertCanReadPpe: jest
        .spyOn(rolePermissions, 'assertCanReadPpe')
        .mockImplementation(() => undefined),
      assertCanManagePpeNorms: jest
        .spyOn(rolePermissions, 'assertCanManagePpeNorms')
        .mockImplementation(() => undefined),
      assertCanManagePpeCatalog: jest
        .spyOn(rolePermissions, 'assertCanManagePpeCatalog')
        .mockImplementation(() => undefined),
      assertCanManageEmployeeSizes: jest
        .spyOn(rolePermissions, 'assertCanManageEmployeeSizes')
        .mockImplementation(() => undefined),
    };
  }

  afterEach(() => jest.restoreAllMocks());

  it.each(normOperations)(
    '$name uses only $permission',
    async ({ permission, invoke }) => {
      const guards = mockPermissions();
      const { controller } = createController();
      await invoke(controller, session('permission-test-role'));
      expect(guards[permission]).toHaveBeenCalledTimes(1);
      expect(guards[permission]).toHaveBeenCalledWith('permission-test-role');
      for (const [name, guard] of Object.entries(guards)) {
        if (name !== permission) expect(guard).not.toHaveBeenCalled();
      }
    },
  );

  it.each(normOperations)(
    '$name stops before service when $permission denies',
    ({ permission, invoke }) => {
      const guards = mockPermissions();
      guards[permission].mockImplementation(() => {
        throw new ForbiddenException();
      });
      const { controller, norms } = createController();
      expect(() => invoke(controller, session('permission-test-role'))).toThrow(
        ForbiddenException,
      );
      for (const operation of Object.values(norms))
        expect(operation).not.toHaveBeenCalled();
    },
  );
});
