jest.mock('@thallesp/nestjs-better-auth', () => {
  const common =
    jest.requireActual<typeof import('@nestjs/common')>('@nestjs/common');
  return {
    Session: common.createParamDecorator(
      (_data: unknown, context: ExecutionContext) =>
        context.switchToHttp().getRequest<{ session: unknown }>().session,
    ),
  };
});

import type { ExecutionContext } from '@nestjs/common';
import { RequestMethod } from '@nestjs/common';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { hasPermission } from '../auth/permission-policy';
import { USER_ROLES, getEffectiveUserRoles } from '../auth/role-module-policy';
import {
  ADDITIONAL_REQUIRED_PERMISSIONS,
  REQUIRED_PERMISSION,
} from '../auth/require-permission';
import { EquipmentController } from './equipment.controller';
import { EquipmentFilesController } from './equipment-files.controller';
import {
  createEquipmentHttpFixture,
  operations,
} from './equipment-http.spec-fixtures';

describe('Equipment and file authorization through the global guard', () => {
  let http: Awaited<ReturnType<typeof createEquipmentHttpFixture>>;
  beforeAll(async () => {
    http = await createEquipmentHttpFixture();
  });
  afterAll(async () => {
    await http?.app.close();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    http.modules.splice(
      0,
      http.modules.length,
      'equipment',
      'ppe',
      'warehouse',
    );
  });
  it('declares the specific equipment or file permission on every tested handler', () => {
    const actual = [EquipmentController, EquipmentFilesController].flatMap(
      (controller) => {
        const prefix = Reflect.getMetadata(PATH_METADATA, controller) as string;
        return Object.getOwnPropertyNames(controller.prototype).flatMap(
          (name) => {
            const handler: unknown = Object.getOwnPropertyDescriptor(
              controller.prototype,
              name,
            )?.value;
            if (typeof handler !== 'function') return [];
            const method: unknown = Reflect.getMetadata(
              METHOD_METADATA,
              handler,
            );
            if (typeof method !== 'number') return [];
            const path = Reflect.getMetadata(PATH_METADATA, handler) as string;
            const fullPath = `/${prefix}/${path}`
              .replace(/:visibleId/g, '1')
              .replace(/:fileId/g, '2')
              .replace(/\/+$/, '');
            const permission: unknown = Reflect.getMetadata(
              REQUIRED_PERMISSION,
              handler,
            );
            return [
              `${RequestMethod[method]} ${fullPath} ${String(permission)}`,
            ];
          },
        );
      },
    );
    expect(
      operations
        .map((op) => `${op.method} ${op.path.split('?')[0]} ${op.permission}`)
        .sort(),
    ).toEqual(actual.sort());
  });
  it.each([...USER_ROLES, 'unknown', 'engineer,storekeeper', 'admin,operator'])(
    'checks every http.equipment and file handler for %s',
    async (role) => {
      for (const operation of operations) {
        jest.clearAllMocks();
        const effectiveRole = getEffectiveUserRoles(role, http.modules).join(
          ',',
        );
        const ownerPermission =
          operation.permission === 'files.read'
            ? 'equipment.read'
            : operation.permission === 'files.manage'
              ? 'equipment.edit'
              : undefined;
        const allowed =
          hasPermission(effectiveRole, operation.permission) &&
          (ownerPermission === undefined ||
            hasPermission(effectiveRole, ownerPermission));
        expect((await http.request(operation, role)).status).toBe(
          allowed ? (operation.method === 'POST' ? 201 : 200) : 403,
        );
        if (!allowed) http.expectNoServiceCalls();
      }
    },
  );
  it('requires the owner permission on every file handler', () => {
    for (const name of Object.getOwnPropertyNames(
      EquipmentFilesController.prototype,
    )) {
      const handler: unknown = Object.getOwnPropertyDescriptor(
        EquipmentFilesController.prototype,
        name,
      )?.value;
      if (
        typeof handler !== 'function' ||
        Reflect.getMetadata(METHOD_METADATA, handler) === undefined
      )
        continue;
      const filePermission: unknown = Reflect.getMetadata(
        REQUIRED_PERMISSION,
        handler,
      );
      expect(
        Reflect.getMetadata(ADDITIONAL_REQUIRED_PERMISSIONS, handler),
      ).toEqual([
        filePermission === 'files.read' ? 'equipment.read' : 'equipment.edit',
      ]);
    }
  });
  it('denies file-only access before owner lookup, upload processing or storage calls', async () => {
    http.modules.splice(0, http.modules.length, 'ppe', 'warehouse');
    for (const operation of operations.filter((op) =>
      op.path.includes('/files'),
    )) {
      jest.clearAllMocks();
      expect((await http.request(operation, 'admin')).status).toBe(403);
      http.expectNoServiceCalls();
    }
  });
  it('rejects unauthenticated requests before services and file processing', async () => {
    for (const operation of operations)
      expect((await http.request(operation)).status).toBe(401);
    http.expectNoServiceCalls();
  });
  it('denies disabled equipment access even to admin', async () => {
    http.modules.splice(0, http.modules.length, 'warehouse');
    for (const operation of operations)
      expect(
        (await http.request(operation, 'engineer,storekeeper')).status,
      ).toBe(403);
    http.expectNoServiceCalls();
    expect((await http.request(operations[0], 'admin,engineer')).status).toBe(
      403,
    );
    http.expectNoServiceCalls();
  });
});
