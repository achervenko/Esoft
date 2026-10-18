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
import { NotFoundException } from '@nestjs/common';
import {
  createEquipmentHttpFixture,
  operations,
  owner,
  root,
  files,
} from './equipment-http.spec-fixtures';

describe('Equipment file HTTP behavior', () => {
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
  it('preserves download and preview streaming headers', async () => {
    const download = await http.request(operations[8], 'operator');
    expect(await download.text()).toBe('file');
    expect(download.headers.get('content-type')).toBe('application/pdf');
    expect(download.headers.get('content-disposition')).toContain('attachment');
    const preview = await http.request(operations[9], 'auditor');
    expect(await preview.text()).toBe('image');
    expect(preview.headers.get('cache-control')).toContain('immutable');
    expect(http.storage.getPreview).toHaveBeenCalledWith({
      fileId: 2,
      owner,
      size: 'small',
    });
  });
  it('preserves parameter and multipart validation after authorization', async () => {
    expect(
      (
        await http.request(
          { path: root + '/invalid', method: 'GET' },
          'engineer',
        )
      ).status,
    ).toBe(400);
    expect(
      (await http.request(operations[7], 'operator', 'invalid')).status,
    ).toBe(403);
    expect(
      (await http.request(operations[7], 'engineer', 'invalid')).status,
    ).toBe(400);
    http.expectNoServiceCalls();
    const preview = await http.request(
      { path: files + '/2/preview?size=invalid', method: 'GET' },
      'engineer',
    );
    expect(preview.status).toBe(400);
    expect(await preview.json()).toMatchObject({
      code: 'INVALID_PREVIEW_SIZE',
    });
    expect(http.storage.getPreview).not.toHaveBeenCalled();
  });
  it('preserves equipment ownership lookup failures before file mutation', async () => {
    http.equipment.findStorageOwnerByVisibleId.mockRejectedValueOnce(
      new NotFoundException(),
    );
    const response = await http.request(operations[10], 'engineer');
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      code: 'EQUIPMENT_NOT_FOUND',
    });
    expect(http.storage.softDeleteFile).not.toHaveBeenCalled();
  });
});
