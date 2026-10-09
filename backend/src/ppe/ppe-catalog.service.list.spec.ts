import { createService, item, size } from './ppe-catalog.service.spec-fixtures';

describe('PPE catalog list', () => {
  it('includes inactive PPE and related sizes', async () => {
    const { service, tx } = createService();
    tx.ppeItem.findUnique.mockResolvedValue({
      ...item,
      type: 'FEET',
      sizes: [size],
      _count: { normItems: 0 },
    });
    await expect(service.listItems()).resolves.toEqual([
      { ...item, isActive: false, sizes: [size], hasActiveNorm: false },
    ]);
    await expect(service.listSizes(1)).resolves.toEqual([size]);
  });
});
