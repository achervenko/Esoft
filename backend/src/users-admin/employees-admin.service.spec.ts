import { EmployeesAdminService } from './employees-admin.service';

const baseEmployee = {
  _count: {
    employeeUsers: 0,
    responsibleEquipment: 0,
  },
  employeeUsers: [],
  firstName: 'Иван',
  id: 1,
  isActive: true,
  lastName: 'Иванов',
  middleName: 'Иванович',
  position: 'Инженер',
};

describe('EmployeesAdminService', () => {
  it('rejects disabling an employee linked to the current user', async () => {
    const { audit, service, tx } = createService();
    tx.employee.findUniqueOrThrow.mockResolvedValueOnce({
      ...baseEmployee,
      employeeUsers: [
        {
          user: {
            banned: false,
            id: 'current-user',
          },
        },
      ],
    });

    await expect(
      service.setEmployeeStatus({
        actorUserId: 'current-user',
        employeeId: 1,
        isActive: false,
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'CANNOT_DISABLE_OWN_EMPLOYEE',
      },
    });

    expect(tx.employee.update).not.toHaveBeenCalled();
    expect(tx.user.updateMany).not.toHaveBeenCalled();
    expect(audit.logEmployeeStatusChanged).not.toHaveBeenCalled();
  });

  it('disables active linked users when disabling another employee', async () => {
    const { audit, service, tx } = createService();
    tx.employee.findUniqueOrThrow
      .mockResolvedValueOnce({
        ...baseEmployee,
        employeeUsers: [
          {
            user: {
              banned: false,
              id: 'active-user',
            },
          },
          {
            user: {
              banned: true,
              id: 'banned-user',
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        ...baseEmployee,
        employeeUsers: [
          {
            user: {
              banned: true,
              id: 'active-user',
            },
          },
          {
            user: {
              banned: true,
              id: 'banned-user',
            },
          },
        ],
        isActive: false,
      });
    tx.employee.update.mockResolvedValueOnce({
      ...baseEmployee,
      isActive: false,
    });
    tx.user.updateMany.mockResolvedValueOnce({ count: 1 });

    const result = await service.setEmployeeStatus({
      actorUserId: 'admin-user',
      employeeId: 1,
      isActive: false,
    });

    expect(result.isActive).toBe(false);
    expect(result.activeAccountCount).toBe(0);
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      data: {
        banExpires: null,
        banReason:
          'Отключено автоматически вследствие отключения связанного сотрудника',
        banned: true,
      },
      where: {
        id: 'active-user',
        OR: [{ banned: false }, { banned: null }],
      },
    });
    expect(tx.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: { in: ['active-user'] } },
    });
    expect(audit.logUserAutoDisabledForEmployee).toHaveBeenCalledTimes(1);
    expect(audit.logUserAutoDisabledForEmployee).toHaveBeenCalledWith({
      actorUserId: 'admin-user',
      oldBanned: false,
      tx,
      userId: 'active-user',
    });
    expect(audit.logEmployeeStatusChanged).toHaveBeenCalledTimes(1);
  });

  it('does not enable linked users when enabling an employee', async () => {
    const { audit, service, tx } = createService();
    tx.employee.findUniqueOrThrow.mockResolvedValueOnce({
      ...baseEmployee,
      employeeUsers: [
        {
          user: {
            banned: true,
            id: 'banned-user',
          },
        },
      ],
      isActive: false,
    });
    tx.employee.update.mockResolvedValueOnce({
      ...baseEmployee,
      employeeUsers: [
        {
          user: {
            banned: true,
            id: 'banned-user',
          },
        },
      ],
      isActive: true,
    });

    await service.setEmployeeStatus({
      actorUserId: 'admin-user',
      employeeId: 1,
      isActive: true,
    });

    expect(tx.user.updateMany).not.toHaveBeenCalled();
    expect(tx.session.deleteMany).not.toHaveBeenCalled();
    expect(audit.logUserAutoDisabledForEmployee).not.toHaveBeenCalled();
    expect(audit.logEmployeeStatusChanged).toHaveBeenCalledTimes(1);
  });

  it('does not write user audit when linked users are already disabled', async () => {
    const { audit, service, tx } = createService();
    tx.employee.findUniqueOrThrow.mockResolvedValueOnce({
      ...baseEmployee,
      employeeUsers: [
        {
          user: {
            banned: true,
            id: 'banned-user',
          },
        },
      ],
    });
    tx.employee.update.mockResolvedValueOnce({
      ...baseEmployee,
      employeeUsers: [
        {
          user: {
            banned: true,
            id: 'banned-user',
          },
        },
      ],
      isActive: false,
    });

    await service.setEmployeeStatus({
      actorUserId: 'admin-user',
      employeeId: 1,
      isActive: false,
    });

    expect(tx.user.updateMany).not.toHaveBeenCalled();
    expect(tx.session.deleteMany).not.toHaveBeenCalled();
    expect(audit.logUserAutoDisabledForEmployee).not.toHaveBeenCalled();
    expect(audit.logEmployeeStatusChanged).toHaveBeenCalledTimes(1);
  });

  it('keeps the transaction rejected if linked user disabling fails', async () => {
    const { service, tx } = createService();
    tx.employee.findUniqueOrThrow.mockResolvedValueOnce({
      ...baseEmployee,
      employeeUsers: [
        {
          user: {
            banned: false,
            id: 'active-user',
          },
        },
      ],
    });
    tx.employee.update.mockResolvedValueOnce({
      ...baseEmployee,
      isActive: false,
    });
    tx.user.updateMany.mockRejectedValueOnce(new Error('database failed'));

    await expect(
      service.setEmployeeStatus({
        actorUserId: 'admin-user',
        employeeId: 1,
        isActive: false,
      }),
    ).rejects.toThrow('database failed');
  });
});

function createService() {
  const tx = {
    employee: {
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    session: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    user: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
  const prisma = {
    $transaction: jest.fn((operation: (transaction: typeof tx) => unknown) =>
      operation(tx),
    ),
  };
  const audit = {
    logEmployeeCreated: jest.fn(),
    logEmployeeStatusChanged: jest.fn().mockResolvedValue(undefined),
    logEmployeeUpdated: jest.fn(),
    logUserAutoDisabledForEmployee: jest.fn().mockResolvedValue(undefined),
  };
  const service = new EmployeesAdminService(audit as never, prisma as never);

  return { audit, prisma, service, tx };
}
