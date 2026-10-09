import { createService, item } from './ppe-catalog.service.spec-fixtures';

describe('PPE catalog audit', () => {
  it('creates the item and its sizes with audit in the same transaction', async () => {
    const { service, tx, auditLog } = createService();
    await service.createItem(
      {
        article: 'A',
        name: 'Boots',
        unit: 'пары',
        type: 'FEET',
        sizes: [{ value: '42' }, { value: '43' }],
      },
      'ppe-actor',
    );
    expect(tx.ppeItem.create).toHaveBeenCalledWith({
      data: { article: 'A', name: 'Boots', unit: 'пары', type: 'FEET' },
    });
    expect(tx.ppeItemSize.create).toHaveBeenNthCalledWith(1, {
      data: { ppeItemId: 1, value: '42', heightValue: null },
    });
    expect(tx.ppeItemSize.create).toHaveBeenNthCalledWith(2, {
      data: { ppeItemId: 1, value: '43', heightValue: null },
    });
    expect(auditLog.writeFieldChanges).toHaveBeenCalledTimes(3);
    for (const [call] of auditLog.writeFieldChanges.mock.calls) {
      expect(call).toEqual(expect.objectContaining({ tx }));
    }
  });

  it('changes an unused type and audits the type field', async () => {
    const { service, tx, auditLog } = createService();
    tx.ppeItem.update.mockResolvedValue({ ...item, type: 'HANDS' });
    const result = await service.updateItem(
      1,
      { article: 'A', name: 'Boots', unit: 'пары', type: 'HANDS' },
      'ppe-actor',
    );
    expect(result.type).toBe('HANDS');
    expect(auditLog.writeFieldChanges).toHaveBeenCalledWith(
      expect.objectContaining({
        fields: [
          { fieldName: 'Тип СИЗ', oldValue: 'OTHER', newValue: 'HANDS' },
        ],
        tx,
      }),
    );
  });

  it('creates PPE with actor and PPE audit in the same transaction', async () => {
    const { service, tx, auditLog } = createService();
    await service.createItem(
      { article: 'A', name: 'Boots', unit: 'пары', type: 'OTHER' },
      'ppe-actor',
    );
    expect(auditLog.writeFieldChanges).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE',
        module: 'PPE',
        entityType: 'ppe_item',
        entityId: 1,
        userId: 'ppe-actor',
        tx,
      }),
    );
  });

  it('edits PPE data and records only the changed field', async () => {
    const { service, tx, auditLog } = createService();
    await service.updateItem(
      1,
      { article: 'A', name: 'New boots', unit: 'пары', type: 'OTHER' },
      'ppe-actor',
    );
    expect(auditLog.writeFieldChanges).toHaveBeenCalledWith(
      expect.objectContaining({
        fields: [
          {
            fieldName: 'Наименование СИЗ',
            oldValue: 'Boots',
            newValue: 'New boots',
          },
        ],
        tx,
      }),
    );
  });

  it('propagates audit failure without committing a successful operation', async () => {
    const { service, tx, auditLog } = createService();
    tx.ppeItem.findUnique.mockResolvedValue({
      ...item,
      type: 'FEET',
      sizes: [],
    });
    auditLog.writeFieldChanges.mockRejectedValue(new Error('audit failed'));
    await expect(
      service.createSize(1, { value: '42' }, 'ppe-actor'),
    ).rejects.toThrow('audit failed');
  });
});
