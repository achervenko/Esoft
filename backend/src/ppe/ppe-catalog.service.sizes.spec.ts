import { Prisma } from '@prisma/client';
import { createService, item, size } from './ppe-catalog.service.spec-fixtures';

describe('PPE catalog sizes', () => {
  it('creates a size with transactional audit', async () => {
    const { service, tx, auditLog } = createService();
    tx.ppeItem.findUnique.mockResolvedValue({
      ...item,
      type: 'FEET',
      sizes: [],
    });
    await service.createSize(1, { value: '42' }, 'ppe-actor');
    expect(tx.ppeItemSize.create).toHaveBeenCalledWith({
      data: { value: '42', heightValue: null, ppeItemId: 1 },
    });
    expect(auditLog.writeFieldChanges).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'ppe_item_size',
        entityId: 2,
        module: 'PPE',
        userId: 'ppe-actor',
        tx,
      }),
    );
  });

  it('edits a size while preserving its parent', async () => {
    const { service, tx } = createService();
    await service.updateSize(1, 2, { value: '43' }, 'ppe-actor');
    expect(tx.ppeItemSize.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { value: '43', heightValue: null },
    });
  });

  it('deactivates a size with audit', async () => {
    const { service, tx, auditLog } = createService();
    tx.ppeItemSize.update.mockResolvedValue({ ...size, isActive: false });
    await service.setSizeStatus(1, 2, { isActive: false }, 'ppe-actor');
    expect(tx.ppeItemSize.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { isActive: false },
    });
    expect(auditLog.writeFieldChanges).toHaveBeenCalledWith(
      expect.objectContaining({
        fields: [{ fieldName: 'Активность', oldValue: true, newValue: false }],
      }),
    );
  });

  it('rejects editing a size through another PPE item', async () => {
    const { service, tx } = createService();
    tx.ppeItemSize.findUnique.mockResolvedValue({ ...size, ppeItemId: 99 });
    await expect(
      service.updateSize(1, 2, { value: '43' }, 'ppe-actor'),
    ).rejects.toMatchObject({ response: { code: 'PPE_SIZE_NOT_FOUND' } });
    expect(tx.ppeItemSize.update).not.toHaveBeenCalled();
  });

  it.each(['create', 'update'] as const)(
    'maps duplicate sizes within the same PPE item to a conflict on %s',
    async (operation) => {
      const { service, tx, auditLog } = createService();
      tx.ppeItem.findUnique.mockResolvedValue({
        ...item,
        type: 'FEET',
        sizes: [],
      });
      tx.ppeItemSize[operation].mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('duplicate size', {
          code: 'P2002',
          clientVersion: '7.9.0',
          meta: { target: ['ppe_item_id', 'value', 'height_value'] },
        }),
      );

      const result =
        operation === 'create'
          ? service.createSize(1, { value: '42' }, 'ppe-actor')
          : service.updateSize(1, 2, { value: '42' }, 'ppe-actor');

      await expect(result).rejects.toMatchObject({
        status: 409,
        response: { code: 'PPE_ITEM_SIZE_CONFLICT' },
      });
      expect(tx.ppeItemSize[operation]).toHaveBeenCalledWith(
        operation === 'create'
          ? { data: { value: '42', heightValue: null, ppeItemId: 1 } }
          : { where: { id: 2 }, data: { value: '42', heightValue: null } },
      );
      expect(auditLog.writeFieldChanges).not.toHaveBeenCalled();
    },
  );

  it('rejects creating sizes for OTHER before mutation or audit', async () => {
    const { service, tx, auditLog } = createService();
    await expect(
      service.createSize(1, { value: '42' }, 'ppe-actor'),
    ).rejects.toMatchObject({
      response: { code: 'PPE_ITEM_SIZES_NOT_ALLOWED' },
    });
    expect(tx.ppeItemSize.create).not.toHaveBeenCalled();
    expect(auditLog.writeFieldChanges).not.toHaveBeenCalled();
  });
  it('replaces a size set using the shared fixture and retains an existing active size', async () => {
    const { service, tx, auditLog } = createService();
    tx.ppeItem.findUnique.mockResolvedValue({
      ...item,
      type: 'FEET',
      sizes: [size],
    });
    await expect(
      service.replaceSizes(1, { sizes: [{ value: '42' }] }, 'ppe-actor'),
    ).resolves.toEqual([size]);
    expect(tx.ppeItemSize.findMany).toHaveBeenNthCalledWith(1, {
      where: { ppeItemId: 1 },
    });
    expect(tx.ppeItemSize.findMany).toHaveBeenNthCalledWith(2, {
      where: { ppeItemId: 1 },
      orderBy: { value: 'asc' },
    });
    expect(tx.ppeItemSize.create).not.toHaveBeenCalled();
    expect(tx.ppeItemSize.update).not.toHaveBeenCalled();
    expect(auditLog.writeFieldChanges).not.toHaveBeenCalled();
  });
});
