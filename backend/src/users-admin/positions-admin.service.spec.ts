import { Prisma } from '@prisma/client';
import { PositionsAdminService } from './positions-admin.service';

function createService() {
  const tx = {
    $queryRaw: jest
      .fn()
      .mockResolvedValue([{ id: 1, name: 'Инженер', isActive: true }]),
    position: {
      create: jest
        .fn()
        .mockResolvedValue({ id: 1, name: 'Инженер', isActive: true }),
      update: jest
        .fn()
        .mockResolvedValue({ id: 1, name: 'Механик', isActive: false }),
    },
  };
  const prisma = {
    $transaction: jest.fn((callback: (value: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  const audit = { writeFieldChanges: jest.fn().mockResolvedValue(undefined) };
  return {
    service: new PositionsAdminService(prisma as never, audit as never),
    tx,
    audit,
  };
}

describe('PositionsAdminService', () => {
  it.each(['', '   ', 'x'.repeat(65)])(
    'rejects an invalid position name',
    async (name) => {
      const { service, tx } = createService();
      await expect(service.save(null, { name }, 'admin')).rejects.toThrow();
      expect(tx.position.create).not.toHaveBeenCalled();
    },
  );

  it('records creation in the same transaction', async () => {
    const { service, tx, audit } = createService();
    tx.$queryRaw.mockResolvedValue([]);
    await service.save(null, { name: ' Инженер ' }, 'admin');
    expect(tx.position.create).toHaveBeenCalledWith({
      data: { name: 'Инженер' },
    });
    expect(audit.writeFieldChanges).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'position',
        entityId: 1,
        userId: 'admin',
        tx,
      }),
    );
  });

  it('rejects duplicate names reported by the database', async () => {
    const { service, tx } = createService();
    tx.$queryRaw.mockResolvedValue([]);
    tx.position.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: '7.9.0',
      }),
    );
    await expect(
      service.save(null, { name: 'Инженер' }, 'admin'),
    ).rejects.toMatchObject({ response: { code: 'POSITION_ALREADY_EXISTS' } });
  });

  it('restores a deleted position with the original ID and records a status change', async () => {
    const { service, tx, audit } = createService();
    tx.$queryRaw.mockResolvedValue([
      { id: 1, name: 'Инженер', isActive: false },
    ]);
    tx.position.update.mockResolvedValue({
      id: 1,
      name: 'Инженер',
      isActive: true,
    });
    await expect(
      service.save(null, { name: 'инженер' }, 'admin'),
    ).resolves.toMatchObject({ id: 1, isActive: true });
    expect(tx.position.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { isActive: true },
    });
    expect(tx.position.create).not.toHaveBeenCalled();
    expect(audit.writeFieldChanges).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'STATUS_CHANGE', entityId: 1, tx }),
    );
  });

  it('rejects creation when the matching position is already active', async () => {
    const { service, tx } = createService();
    await expect(
      service.save(null, { name: 'Инженер' }, 'admin'),
    ).rejects.toMatchObject({ response: { code: 'POSITION_ALREADY_EXISTS' } });
    expect(tx.position.create).not.toHaveBeenCalled();
    expect(tx.position.update).not.toHaveBeenCalled();
  });

  it('rejects renaming a missing position', async () => {
    const { service, tx } = createService();
    tx.$queryRaw.mockResolvedValue([]);
    await expect(
      service.save(99, { name: 'Инженер' }, 'admin'),
    ).rejects.toMatchObject({ response: { code: 'POSITION_NOT_FOUND' } });
    expect(tx.position.update).not.toHaveBeenCalled();
  });

  it('records disabling a position without changing employees', async () => {
    const { service, tx, audit } = createService();
    await service.setStatus(1, false, 'admin');
    expect(tx.position.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { isActive: false },
    });
    expect(audit.writeFieldChanges).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'STATUS_CHANGE', tx }),
    );
  });

  it('propagates an audit failure', async () => {
    const { service, tx, audit } = createService();
    tx.$queryRaw.mockResolvedValue([]);
    audit.writeFieldChanges.mockRejectedValue(new Error('audit failed'));
    await expect(
      service.save(null, { name: 'Инженер' }, 'admin'),
    ).rejects.toThrow('audit failed');
  });
});
