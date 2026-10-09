import { Prisma } from '@prisma/client';
import { createService, item } from './ppe-catalog.service.spec-fixtures';

describe('PPE catalog items', () => {
  it.each([{ unit: 'мл' }, { type: 'FEET' }])(
    'blocks catalog changes that would rewrite a referenced norm: %j',
    async (patch) => {
      const { service, tx, auditLog } = createService();
      tx.ppeNormItem.count.mockResolvedValue(1);
      await expect(
        service.updateItem(
          1,
          {
            article: item.article,
            name: item.name,
            unit: item.unit,
            type: item.type,
            ...patch,
          },
          'ppe-actor',
        ),
      ).rejects.toMatchObject({ response: { code: 'PPE_ITEM_IN_NORM' } });
      expect(tx.ppeItem.update).not.toHaveBeenCalled();
      expect(auditLog.writeFieldChanges).not.toHaveBeenCalled();
    },
  );

  it('rejects type changes after any issue without writing data or audit', async () => {
    const { service, tx, auditLog } = createService();
    tx.ppeIssue.count.mockResolvedValue(1);
    await expect(
      service.updateItem(
        1,
        { article: 'A', name: 'Boots', unit: 'пары', type: 'HANDS' },
        'ppe-actor',
      ),
    ).rejects.toMatchObject({ response: { code: 'PPE_ITEM_TYPE_IN_USE' } });
    expect(tx.ppeItem.update).not.toHaveBeenCalled();
    expect(auditLog.writeFieldChanges).not.toHaveBeenCalled();
  });

  it('rejects type changes when only the normative PPE is referenced in history', async () => {
    const { service, tx, auditLog } = createService();
    const historicalIssue = {
      ppeItemId: 55,
      normItemPpeItemId: 1,
      status: 'CANCELLED',
    };
    tx.ppeIssue.count.mockImplementation(
      (query?: {
        where: {
          OR?: Array<{ ppeItemId?: number; normItemPpeItemId?: number }>;
        };
      }) =>
        Promise.resolve(
          query?.where.OR?.some(
            (condition) =>
              (condition.ppeItemId !== undefined &&
                condition.ppeItemId === historicalIssue.ppeItemId) ||
              (condition.normItemPpeItemId !== undefined &&
                condition.normItemPpeItemId ===
                  historicalIssue.normItemPpeItemId),
          )
            ? 1
            : 0,
        ),
    );
    await expect(
      service.updateItem(
        1,
        { article: 'A', name: 'Boots', unit: 'пары', type: 'HANDS' },
        'ppe-actor',
      ),
    ).rejects.toMatchObject({ response: { code: 'PPE_ITEM_TYPE_IN_USE' } });
    expect(tx.ppeIssue.count).toHaveBeenCalledWith({
      where: { OR: [{ ppeItemId: 1 }, { normItemPpeItemId: 1 }] },
    });
    expect(tx.ppeItem.update).not.toHaveBeenCalled();
    expect(auditLog.writeFieldChanges).not.toHaveBeenCalled();
  });

  it('allows changing an unused article', async () => {
    const { service, tx } = createService();
    await service.updateItem(
      1,
      { article: 'B', name: 'Boots', unit: 'пары', type: 'OTHER' },
      'ppe-actor',
    );
    expect(tx.ppeItem.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { article: 'B', name: 'Boots', unit: 'пары', type: 'OTHER' },
    });
  });

  it.each(['norm', 'issue'])(
    'protects an article referenced by a %s',
    async (kind) => {
      const { service, tx } = createService();
      if (kind === 'norm') tx.ppeNormItem.count.mockResolvedValue(1);
      else tx.ppeIssue.count.mockResolvedValue(1);
      await expect(
        service.updateItem(
          1,
          { article: 'B', name: 'Boots', unit: 'пары', type: 'OTHER' },
          'ppe-actor',
        ),
      ).rejects.toMatchObject({ response: { code: 'PPE_ARTICLE_IN_USE' } });
      expect(tx.ppeItem.update).not.toHaveBeenCalled();
    },
  );

  it('deactivates PPE without physical deletion', async () => {
    const { service, tx, auditLog } = createService();
    tx.ppeItem.update.mockResolvedValue({ ...item, isActive: false });
    await service.setItemStatus(1, { isActive: false }, 'ppe-actor');
    expect(tx.ppeItem.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { isActive: false },
    });
    expect(auditLog.writeFieldChanges).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'STATUS_CHANGE',
        userId: 'ppe-actor',
        tx,
      }),
    );
  });

  it('maps duplicate articles to a conflict', async () => {
    const { service, tx } = createService();
    tx.ppeItem.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: '7.9.0',
        meta: { target: ['article'] },
      }),
    );
    await expect(
      service.createItem(
        { article: 'A', name: 'Boots', unit: 'пары', type: 'OTHER' },
        'ppe-actor',
      ),
    ).rejects.toMatchObject({
      response: { code: 'PPE_ITEM_ARTICLE_CONFLICT' },
    });
  });

  it('rejects changing to OTHER when any sizes exist', async () => {
    const { service, tx, auditLog } = createService();
    tx.ppeItem.findUnique.mockResolvedValue({
      ...item,
      type: 'FEET',
      sizes: [],
    });
    tx.ppeItemSize.count.mockResolvedValue(1);
    await expect(
      service.updateItem(
        1,
        { article: 'A', name: 'Boots', unit: 'пары', type: 'OTHER' },
        'ppe-actor',
      ),
    ).rejects.toMatchObject({ response: { code: 'PPE_ITEM_HAS_SIZES' } });
    expect(tx.ppeItemSize.count).toHaveBeenCalledWith({
      where: { ppeItemId: 1 },
    });
    expect(tx.ppeItem.update).not.toHaveBeenCalled();
    expect(auditLog.writeFieldChanges).not.toHaveBeenCalled();
  });
});
