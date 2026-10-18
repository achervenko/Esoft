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
import { StorageDocumentType } from '@prisma/client';
import { createPermissionsHttpFixture } from '../auth/permissions-http.fixture';
import { EquipmentFilesController } from './equipment-files.controller';
import { EquipmentService } from './equipment.service';
import { StorageFileService } from '../storage/storage-file.service';

const operations = [
  { method: 'GET', suffix: '' },
  { method: 'POST', suffix: '' },
  { method: 'GET', suffix: '/2/download' },
  { method: 'GET', suffix: '/2/preview' },
  { method: 'DELETE', suffix: '/2' },
  { method: 'PATCH', suffix: '/2/primary' },
];
describe('Equipment file route ID validation', () => {
  let http: Awaited<ReturnType<typeof createPermissionsHttpFixture>>;
  let base: string;
  const equipment = {
    findStorageOwnerByVisibleId: jest
      .fn()
      .mockResolvedValue({ equipmentId: 1 }),
  };
  const storage = Object.fromEntries(
    [
      'listFiles',
      'uploadFile',
      'getDownload',
      'getPreview',
      'softDeleteFile',
      'setPrimaryFile',
    ].map((action) => [action, jest.fn().mockResolvedValue({})]),
  );
  beforeAll(async () => {
    http = await createPermissionsHttpFixture({
      controllers: [EquipmentFilesController],
      providers: [
        { provide: EquipmentService, useValue: equipment },
        { provide: StorageFileService, useValue: storage },
      ],
    });
    base = await http.app.getUrl();
  });
  afterAll(async () => {
    await http?.app.close();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    http.modules.splice(0, http.modules.length, 'equipment');
  });
  async function request(path: string, method: string) {
    if (method !== 'POST') return http.request({ path, method }, 'admin');
    const form = new FormData();
    form.set('documentType', StorageDocumentType.passport);
    form.set(
      'file',
      new Blob(['test'], { type: 'application/pdf' }),
      'test.pdf',
    );
    return fetch(base + path, {
      method,
      headers: { 'x-role': 'admin' },
      body: form,
    });
  }
  async function expectInvalidId(path: string, method: string) {
    const response = await request(path, method);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'ROUTE_ID_INVALID' });
    expect(equipment.findStorageOwnerByVisibleId).not.toHaveBeenCalled();
    for (const mock of Object.values(storage))
      expect(mock).not.toHaveBeenCalled();
  }
  describe.each(['0', '-1', '9007199254740992'])('invalid ID %s', (id) => {
    it.each(operations)(
      'rejects visibleId on $method /files$suffix',
      async ({ method, suffix }) => {
        await expectInvalidId(`/api/equipment/${id}/files${suffix}`, method);
      },
    );
    it.each(operations.filter((op) => op.suffix))(
      'rejects fileId on $method /files$suffix',
      async ({ method, suffix }) => {
        await expectInvalidId(
          `/api/equipment/1/files${suffix.replace('/2', '/' + id)}`,
          method,
        );
      },
    );
  });
});
