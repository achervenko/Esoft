import { baseEmployee, createService } from './employees-admin.spec-fixtures';

describe('EmployeesAdminService status', () => {
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

  it.each([false, null])(
    'disables active linked users with banned=%s when disabling another employee',
    async (oldBanned) => {
      const { audit, service, tx } = createService();
      tx.employee.findUniqueOrThrow
        .mockResolvedValueOnce({
          ...baseEmployee,
          employeeUsers: [
            {
              user: {
                banned: oldBanned,
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
      expect(
        (tx.$queryRaw.mock.calls[0] as [TemplateStringsArray])[0].join(''),
      ).toContain('FOR UPDATE');
      expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        tx.employee.findUniqueOrThrow.mock.invocationCallOrder[0],
      );
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
        oldBanned,
        tx,
        userId: 'active-user',
      });
      expect(audit.logEmployeeStatusChanged).toHaveBeenCalledTimes(1);
    },
  );

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
