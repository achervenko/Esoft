import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EventsAccessAssertions } from './events-access.assertions';
import { EQUIPMENT_RESPONSIBLE_ROLES } from './events-responsible-policy';

describe('equipment event responsible users', () => {
  it('uses equipment access roles without administrators in the locked validation query', async () => {
    const queryRaw = jest
      .fn<Promise<{ id: string }[]>, [TemplateStringsArray, ...unknown[]]>()
      .mockResolvedValue([{ id: 'engineer-user' }]);
    await new EventsAccessAssertions().assertResponsibleUsersExist(
      { $queryRaw: queryRaw } as never,
      ['engineer-user'],
    );
    const [parts, ...values] = queryRaw.mock.calls[0];
    expect(parts.join('?')).toContain('AND u.role IN');
    expect(parts.join('?')).toContain('FOR SHARE OF u, eu, e');
    expect(Prisma.sql(parts, ...values).values).toEqual([
      'engineer-user',
      ...EQUIPMENT_RESPONSIBLE_ROLES,
    ]);
    expect(EQUIPMENT_RESPONSIBLE_ROLES).not.toContain('admin');
    expect(EQUIPMENT_RESPONSIBLE_ROLES).not.toContain('ppe_specialist');
    expect(EQUIPMENT_RESPONSIBLE_ROLES).not.toContain('accounting_specialist');
  });
  it('rejects the complete assignment if any selected user is ineligible', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'engineer-user' }]),
    };
    await expect(
      new EventsAccessAssertions().assertResponsibleUsersExist(tx as never, [
        'engineer-user',
        'admin-user',
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
