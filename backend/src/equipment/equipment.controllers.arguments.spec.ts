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
import { AuditModule, StorageDocumentType } from '@prisma/client';
import {
  createEquipmentHttpFixture,
  operations,
  owner,
} from './equipment-http.spec-fixtures';

describe('Equipment controller service arguments', () => {
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
  it('forwards actor, file owner and audit module for mutations', async () => {
    for (const operation of operations.filter(
      (value) => value.method !== 'GET',
    ))
      expect((await http.request(operation, 'engineer')).status).toBe(
        operation.method === 'POST' ? 201 : 200,
      );
    expect(http.equipment.create).toHaveBeenCalledWith(
      { name: 'Test' },
      'actor',
    );
    expect(http.equipment.update).toHaveBeenCalledWith(
      1,
      { name: 'Updated' },
      'actor',
    );
    expect(http.storage.uploadFile).toHaveBeenCalledWith(
      expect.objectContaining({
        owner,
        userId: 'actor',
        documentType: StorageDocumentType.passport,
        file: expect.objectContaining({
          originalname: 'test.pdf',
          size: 4,
        }) as unknown,
        audit: { actionModule: AuditModule.EQUIPMENT },
      }),
    );
    for (const action of ['softDeleteFile', 'setPrimaryFile'])
      expect(http.storage[action]).toHaveBeenCalledWith({
        fileId: 2,
        owner,
        userId: 'actor',
        audit: { actionModule: AuditModule.EQUIPMENT },
      });
  });
});
