import {
  createPermissionsHttpFixture,
  type HttpOperation,
} from '../auth/permissions-http.fixture';
import type { Permission } from '../auth/permission-policy';
import { EQUIPMENT_PERMISSIONS } from './equipment.permissions';
import { FILES_PERMISSIONS } from '../storage/files.permissions';
import { StorageDocumentType } from '@prisma/client';
import { EquipmentController } from './equipment.controller';
import { EquipmentFilesController } from './equipment-files.controller';
import { EquipmentService } from './equipment.service';
import { StorageFileService } from '../storage/storage-file.service';

export type Operation = HttpOperation & { permission: Permission };
export const root = '/api/equipment';
export const files = root + '/1/files';
export const operations: Operation[] = [
  { path: root, method: 'GET', permission: EQUIPMENT_PERMISSIONS.READ },
  {
    path: root + '/create-options?visibleId=1',
    method: 'GET',
    permission: EQUIPMENT_PERMISSIONS.READ,
  },
  { path: root + '/1', method: 'GET', permission: EQUIPMENT_PERMISSIONS.READ },
  {
    path: root + '/1/history',
    method: 'GET',
    permission: EQUIPMENT_PERMISSIONS.READ,
  },
  {
    path: root,
    method: 'POST',
    permission: EQUIPMENT_PERMISSIONS.EDIT,
    body: { name: 'Test' },
  },
  {
    path: root + '/1',
    method: 'PUT',
    permission: EQUIPMENT_PERMISSIONS.EDIT,
    body: { name: 'Updated' },
  },
  { path: files, method: 'GET', permission: FILES_PERMISSIONS.READ },
  {
    path: files,
    method: 'POST',
    permission: FILES_PERMISSIONS.MANAGE,
    upload: true,
  },
  {
    path: files + '/2/download',
    method: 'GET',
    permission: FILES_PERMISSIONS.READ,
  },
  {
    path: files + '/2/preview?size=small',
    method: 'GET',
    permission: FILES_PERMISSIONS.READ,
  },
  {
    path: files + '/2',
    method: 'DELETE',
    permission: FILES_PERMISSIONS.MANAGE,
  },
  {
    path: files + '/2/primary',
    method: 'PATCH',
    permission: FILES_PERMISSIONS.MANAGE,
  },
];

export const owner = { equipmentId: 1 };

export async function createEquipmentHttpFixture() {
  const equipment: Record<string, jest.Mock<Promise<unknown>, unknown[]>> = {
    ...Object.fromEntries(
      [
        'findAll',
        'getCreateOptions',
        'findOneByVisibleId',
        'findHistoryByVisibleId',
        'create',
        'update',
      ].map((action) => [
        action,
        jest.fn<Promise<object>, unknown[]>().mockResolvedValue({}),
      ]),
    ),
    findStorageOwnerByVisibleId: jest
      .fn<Promise<unknown>, unknown[]>()
      .mockResolvedValue(owner),
  };
  const storage: Record<string, jest.Mock<Promise<unknown>, unknown[]>> = {
    ...Object.fromEntries(
      ['listFiles', 'uploadFile', 'softDeleteFile', 'setPrimaryFile'].map(
        (action) => [
          action,
          jest.fn<Promise<object>, unknown[]>().mockResolvedValue({}),
        ],
      ),
    ),
    getDownload: jest.fn<Promise<unknown>, unknown[]>().mockImplementation(() =>
      Promise.resolve({
        body: Buffer.from('file'),
        contentType: 'application/pdf',
        fileName: 'test.pdf',
        contentLength: 4,
      }),
    ),
    getPreview: jest.fn<Promise<unknown>, unknown[]>().mockImplementation(() =>
      Promise.resolve({
        body: Buffer.from('image'),
        contentType: 'image/webp',
        fileName: 'test.webp',
        contentLength: 5,
        isOptimizedImagePreview: true,
      }),
    ),
  };
  const http = await createPermissionsHttpFixture({
    controllers: [EquipmentController, EquipmentFilesController],
    providers: [
      { provide: EquipmentService, useValue: equipment },
      { provide: StorageFileService, useValue: storage },
    ],
  });
  const base = await http.app.getUrl();
  function request(
    operation: HttpOperation,
    role?: string,
    documentType: string = StorageDocumentType.passport,
  ) {
    if (!operation.upload) return http.request(operation, role);
    const form = new FormData();
    form.set('documentType', documentType);
    form.set(
      'file',
      new Blob(['test'], { type: 'application/pdf' }),
      'test.pdf',
    );
    return fetch(base + operation.path, {
      method: operation.method,
      headers: role === undefined ? {} : { 'x-role': role },
      body: form,
    });
  }
  function expectNoServiceCalls() {
    for (const mock of [...Object.values(equipment), ...Object.values(storage)])
      expect(mock).not.toHaveBeenCalled();
  }
  return { ...http, equipment, storage, request, expectNoServiceCalls };
}
