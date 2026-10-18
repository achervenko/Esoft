import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EventsAccessAssertions } from './events-access.assertions';
import { getEquipmentResponsibleRoles } from '../auth/role-permissions';
const responsibleRoles = getEquipmentResponsibleRoles(['equipment']);

describe('equipment event responsible users', () => {
  it('uses equipment access roles without administrators in the locked validation query', async () => {
    const queryRaw = jest
      .fn<Promise<{ id: string }[]>, [TemplateStringsArray, ...unknown[]]>()
      .mockResolvedValue([{ id: 'engineer-user' }]);
    await new EventsAccessAssertions(['equipment']).assertResponsibleUsersExist(
      { $queryRaw: queryRaw } as never,
      ['engineer-user'],
    );
    const [parts, ...values] = queryRaw.mock.calls[0];
    expect(Prisma.sql(parts, ...values).sql).toContain(
      'regexp_split_to_table(COALESCE(u.role',
    );
    expect(Prisma.sql(parts, ...values).sql).toContain(
      'BTRIM(assigned_role.value) IN',
    );
    expect(parts.join('?')).toContain('FOR SHARE OF u, eu, e');
    expect(Prisma.sql(parts, ...values).values).toEqual([
      'engineer-user',
      ...responsibleRoles,
    ]);
    expect(responsibleRoles).not.toContain('admin');
    expect(responsibleRoles).not.toContain('ppe_specialist');
    expect(responsibleRoles).not.toContain('accounting_specialist');
  });
  it('rejects the complete assignment if any selected user is ineligible', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'engineer-user' }]),
    };
    await expect(
      new EventsAccessAssertions(['equipment']).assertResponsibleUsersExist(
        tx as never,
        ['engineer-user', 'admin-user'],
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('rejects direct assignment without querying users when equipment is disabled', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'engineer-user' }]),
    };
    await expect(
      new EventsAccessAssertions(['warehouse']).assertResponsibleUsersExist(
        tx as never,
        ['engineer-user'],
      ),
    ).rejects.toMatchObject({
      response: { code: 'RESPONSIBLE_USER_INACTIVE' },
    });
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });
});
