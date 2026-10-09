import { getBusinessTodayDate } from '../application/business-date';
import {
  baseEmployee,
  payload,
  createService,
} from './employees-admin.spec-fixtures';

describe('EmployeesAdminService assignment', () => {
  it('starts entitlement on initial assignment instead of accruing months before employee creation', async () => {
    const { service, tx } = createService();
    tx.$queryRaw.mockResolvedValue([{ isActive: true }]);
    tx.employee.create.mockResolvedValue(baseEmployee);
    await service.createEmployee(payload);
    expect(tx.employee.create).toHaveBeenCalledWith({
      include: { position: true },
      data: {
        ...payload,
        middleName: null,
        positionAssignedAt: getBusinessTodayDate(),
      },
    });
  });

  it('records the assignment date only when position changes', async () => {
    const { service, tx } = createService();
    tx.$queryRaw.mockResolvedValue([{ isActive: true }]);
    tx.employee.findUniqueOrThrow.mockResolvedValue(baseEmployee);
    tx.employee.update.mockResolvedValue(baseEmployee);
    await service.updateEmployee(1, { ...payload, positionId: 2 });
    const [changed] = tx.employee.update.mock.calls.at(-1)! as [
      { data: Record<string, unknown> },
    ];
    expect(changed.data).toMatchObject({
      positionAssignedAt: getBusinessTodayDate(),
    });
    await service.updateEmployee(1, payload);
    const [retained] = tx.employee.update.mock.calls.at(-1)! as [
      { data: Record<string, unknown> },
    ];
    expect(retained.data).not.toHaveProperty('positionAssignedAt');
  });

  it('rejects assigning an inactive position to a new employee', async () => {
    const { service, tx } = createService();
    tx.$queryRaw.mockResolvedValue([{ isActive: false }]);
    await expect(service.createEmployee(payload)).rejects.toMatchObject({
      response: { code: 'POSITION_INACTIVE' },
    });
    expect(tx.employee.create).not.toHaveBeenCalled();
  });

  it('rejects an unknown position', async () => {
    const { service, tx } = createService();
    tx.$queryRaw.mockResolvedValue([]);
    await expect(service.createEmployee(payload)).rejects.toMatchObject({
      response: { code: 'POSITION_NOT_FOUND' },
    });
    expect(tx.employee.create).not.toHaveBeenCalled();
  });

  it('allows retaining the existing inactive position', async () => {
    const { service, tx, audit } = createService();
    tx.$queryRaw.mockResolvedValue([{ isActive: false }]);
    tx.employee.findUniqueOrThrow.mockResolvedValue(baseEmployee);
    tx.employee.update.mockResolvedValue(baseEmployee);
    await expect(service.updateEmployee(1, payload)).resolves.toMatchObject({
      position: 'Инженер',
      positionId: 1,
    });
    expect(audit.logEmployeeUpdated).toHaveBeenCalled();
  });

  it('rejects replacing an existing position with another inactive position', async () => {
    const { service, tx } = createService();
    tx.$queryRaw.mockResolvedValue([{ isActive: false }]);
    tx.employee.findUniqueOrThrow.mockResolvedValue(baseEmployee);
    await expect(
      service.updateEmployee(1, { ...payload, positionId: 2 }),
    ).rejects.toMatchObject({ response: { code: 'POSITION_INACTIVE' } });
    expect(tx.employee.update).not.toHaveBeenCalled();
  });
});
