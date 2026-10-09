import { Prisma } from '@prisma/client';
import { PpeEmployeesService } from './ppe-employees.service';
import { PpeAuditService } from './ppe-audit.service';

const employee = {
  id: 1,
  firstName: 'Иван',
  lastName: 'Иванов',
  middleName: null,
  positionId: 2,
  position: { name: 'Сварщик' },
  isActive: true,
  clothingSize: '50',
  clothingHeight: '170–176',
  shoeSize: new Prisma.Decimal('42'),
  gloveSize: null,
  headwearSize: null,
};

function createService() {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 1 }]),
    employee: {
      findUnique: jest.fn().mockResolvedValue(employee),
      findMany: jest
        .fn()
        .mockResolvedValue([employee, { ...employee, id: 2, isActive: false }]),
      update: jest.fn().mockResolvedValue({ ...employee, clothingSize: '52' }),
    },
    position: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const prisma = {
    ...tx,
    $transaction: jest.fn((fn: (value: typeof tx) => unknown) => fn(tx)),
  };
  const auditLog = {
    writeFieldChanges: jest.fn().mockResolvedValue(undefined),
  };
  const service = new PpeEmployeesService(
    prisma as never,
    new PpeAuditService(auditLog as never),
  );
  return { service, tx, auditLog };
}

describe('PPE employee access', () => {
  it('includes inactive employees and returns only PPE fields', async () => {
    const { service, tx } = createService();
    const result = await service.list();
    expect(result[1].isActive).toBe(false);
    expect(result[0]).toEqual({
      ...employee,
      position: 'Сварщик',
      shoeSize: 42,
    });
    const [query] = tx.employee.findMany.mock.calls[0] as [
      { select: Record<string, unknown> },
    ];
    expect(query.select).not.toHaveProperty('employeeUsers');
    expect(query.select).not.toHaveProperty('email');
  });

  it('reads inactive employee sizes', async () => {
    const { service, tx } = createService();
    tx.employee.findUnique.mockResolvedValue({ ...employee, isActive: false });
    await expect(service.findOne(1)).resolves.toMatchObject({
      isActive: false,
      shoeSize: 42,
    });
  });

  it('locks the employee and changes only supplied sizes with transactional PPE audit', async () => {
    const { service, tx, auditLog } = createService();
    await expect(
      service.updateSizes(1, { clothingSize: ' 52 ' }, 'ppe-actor'),
    ).resolves.toMatchObject({ clothingSize: '52' });
    expect(tx.employee.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { clothingSize: '52' } }),
    );
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.employee.findUnique.mock.invocationCallOrder[0],
    );
    expect(auditLog.writeFieldChanges).toHaveBeenCalledWith({
      action: 'UPDATE',
      module: 'PPE',
      entityType: 'employee',
      entityId: 1,
      userId: 'ppe-actor',
      tx,
      fields: [{ fieldName: 'Размер одежды', oldValue: '50', newValue: '52' }],
    });
  });

  it('rejects attempts to change position or status before any mutation', async () => {
    const { service, tx } = createService();
    await expect(
      service.updateSizes(
        1,
        { clothingSize: '52', positionId: 10, isActive: false },
        'ppe-actor',
      ),
    ).rejects.toMatchObject({ response: { code: 'UNKNOWN_FIELDS' } });
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.employee.update).not.toHaveBeenCalled();
  });

  it('refuses to change inactive employee sizes', async () => {
    const { service, tx, auditLog } = createService();
    tx.employee.findUnique.mockResolvedValue({ ...employee, isActive: false });
    await expect(
      service.updateSizes(1, { clothingSize: '52' }, 'ppe-actor'),
    ).rejects.toMatchObject({ response: { code: 'EMPLOYEE_INACTIVE' } });
    expect(tx.employee.update).not.toHaveBeenCalled();
    expect(auditLog.writeFieldChanges).not.toHaveBeenCalled();
  });

  it('does not normalize decimal shoe size into a false audit change', async () => {
    const { service, tx, auditLog } = createService();
    tx.employee.update.mockResolvedValue(employee);
    await service.updateSizes(1, { shoeSize: 42 }, 'ppe-actor');
    expect(auditLog.writeFieldChanges).toHaveBeenCalledWith(
      expect.objectContaining({ fields: [] }),
    );
  });

  it('rejects the transaction if audit fails', async () => {
    const { service, auditLog } = createService();
    auditLog.writeFieldChanges.mockRejectedValue(new Error('audit failed'));
    await expect(
      service.updateSizes(1, { clothingSize: '52' }, 'ppe-actor'),
    ).rejects.toThrow('audit failed');
  });
});
