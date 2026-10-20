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

import { type ExecutionContext, RequestMethod } from '@nestjs/common';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { Readable } from 'node:stream';
import { REQUIRED_PERMISSION } from '../../auth/require-permission';
import { createPermissionsHttpFixture } from '../../auth/permissions-http.fixture';
import {
  USER_ROLES,
  getEffectiveUserRoles,
} from '../../auth/role-module-policy';
import { hasPermission } from '../../auth/permission-policy';
import { StorageFileService } from '../../storage/storage-file.service';
import { WarehouseStockAdjustmentsService } from './adjustments.service';
import { WarehouseStockAdjustmentsController } from './adjustments.controller';
import { WAREHOUSE_PERMISSIONS } from '../warehouse.permissions';

const root = '/api/warehouse/adjustments';
const operations = [
  { method: 'GET', path: root, action: 'list' },
  { method: 'POST', path: root, action: 'adjustStock' },
  {
    method: 'POST',
    path: root + '/documents',
    action: 'uploadDocument',
    upload: true,
  },
  { method: 'GET', path: root + '/1', action: 'get' },
  { method: 'GET', path: root + '/1/documents/1/download', action: 'get' },
];

describe('StockAdjustments HTTP permissions', () => {
  let http: Awaited<ReturnType<typeof createPermissionsHttpFixture>>;
  const adjustments = {
    list: jest.fn().mockResolvedValue({ items: [] }),
    adjustStock: jest.fn().mockResolvedValue({}),
    uploadDocument: jest.fn().mockResolvedValue({}),
    get: jest.fn().mockResolvedValue({ id: '1' }),
  };
  const files = { getDownload: jest.fn() };
  beforeAll(async () => {
    http = await createPermissionsHttpFixture({
      controllers: [WarehouseStockAdjustmentsController],
      providers: [
        { provide: WarehouseStockAdjustmentsService, useValue: adjustments },
        { provide: StorageFileService, useValue: files },
      ],
    });
  });
  afterAll(async () => {
    await http?.app.close();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    http.modules.splice(0, http.modules.length, 'warehouse');
    files.getDownload.mockImplementation(() =>
      Promise.resolve({
        body: Readable.from('pdf'),
        contentType: 'application/pdf',
        fileName: 'basis.pdf',
      }),
    );
  });
  it('covers every handler and its explicit permission', () => {
    const actual = Object.getOwnPropertyNames(
      WarehouseStockAdjustmentsController.prototype,
    ).flatMap((name) => {
      const handler: unknown = Object.getOwnPropertyDescriptor(
        WarehouseStockAdjustmentsController.prototype,
        name,
      )?.value;
      if (typeof handler !== 'function') return [];
      const method: unknown = Reflect.getMetadata(METHOD_METADATA, handler);
      if (typeof method !== 'number') return [];
      const path = Reflect.getMetadata(PATH_METADATA, handler) as string;
      expect(Reflect.getMetadata(REQUIRED_PERMISSION, handler)).toBe(
        WAREHOUSE_PERMISSIONS.ADJUSTMENTS_MANAGE,
      );
      return [
        `${RequestMethod[method]} ${root}/${path}`
          .replace(/:id|:fileId/g, '1')
          .replace(/\/+$/, ''),
      ];
    });
    expect(actual.sort()).toEqual(
      operations.map((op) => `${op.method} ${op.path}`).sort(),
    );
  });
  it.each([
    ...USER_ROLES,
    'admin,storekeeper',
    'engineer,storekeeper',
    'unknown',
  ])('enforces the policy before calling services for %s', async (role) => {
    const allowed = hasPermission(
      getEffectiveUserRoles(role, http.modules).join(','),
      WAREHOUSE_PERMISSIONS.ADJUSTMENTS_MANAGE,
    );
    for (const operation of operations) {
      jest.clearAllMocks();
      const response = await http.request(operation, role);
      expect(response.status).toBe(
        allowed ? (operation.method === 'POST' ? 201 : 200) : 403,
      );
      await response.arrayBuffer();
      if (!allowed) {
        for (const mock of Object.values(adjustments))
          expect(mock).not.toHaveBeenCalled();
        expect(files.getDownload).not.toHaveBeenCalled();
      }
    }
  });
  it('rejects anonymous requests before validation and services', async () => {
    for (const operation of operations)
      expect((await http.request(operation)).status).toBe(401);
    for (const mock of Object.values(adjustments))
      expect(mock).not.toHaveBeenCalled();
  });
  it('forwards the audit actor and binds downloads to the adjustment owner', async () => {
    await http.request(
      { method: 'POST', path: root, body: { test: 'payload' } },
      'admin',
    );
    expect(adjustments.adjustStock).toHaveBeenCalledWith(
      { test: 'payload' },
      'actor',
    );
    await http.request(
      { method: 'POST', path: root + '/documents', upload: true },
      'admin',
    );
    expect(adjustments.uploadDocument).toHaveBeenCalledWith(
      expect.objectContaining({ originalname: 'test.png' }),
      'actor',
    );
    await http.request(
      { method: 'GET', path: root + '/1/documents/1/download' },
      'admin',
    );
    expect(adjustments.get).toHaveBeenCalledWith('1', 'actor');
    expect(files.getDownload).toHaveBeenCalledWith({
      fileId: 1,
      owner: {
        module: 'warehouse',
        entityType: 'stock_adjustment',
        entityId: '1',
      },
    });
  });
});
