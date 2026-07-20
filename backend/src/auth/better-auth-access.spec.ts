jest.mock('better-auth/plugins/access', () => ({
  createAccessControl: () => ({
    newRole: (statements: Record<string, string[]>) => ({
      authorize: (request: Record<string, string[]>) => {
        const isAllowed = Object.entries(request).every(([resource, actions]) =>
          actions.every((action) => statements[resource]?.includes(action)),
        );

        return { success: isAllowed };
      },
      statements,
    }),
  }),
}));

jest.mock('better-auth/plugins/admin/access', () => ({
  defaultStatements: {
    user: [
      'create',
      'list',
      'set-role',
      'ban',
      'impersonate',
      'impersonate-admins',
      'delete',
      'set-password',
      'set-email',
      'get',
      'update',
    ],
    session: ['list', 'revoke', 'delete'],
  },
}));

import {
  adminRole,
  auditorRole,
  chiefEngineerRole,
  engineerRole,
  operatorRole,
} from './better-auth-access';

describe('Better Auth access control', () => {
  it('does not allow admin impersonation', () => {
    expect(adminRole.authorize({ user: ['impersonate'] }).success).toBe(false);
    expect(adminRole.authorize({ user: ['impersonate-admins'] }).success).toBe(
      false,
    );
  });

  it('does not allow admin user deletion', () => {
    expect(adminRole.authorize({ user: ['delete'] }).success).toBe(false);
  });

  it('keeps required account management permissions for admin', () => {
    expect(
      adminRole.authorize({
        user: [
          'create',
          'list',
          'set-role',
          'ban',
          'set-password',
          'set-email',
          'get',
          'update',
        ],
        session: ['list', 'revoke', 'delete'],
      }).success,
    ).toBe(true);
  });

  it.each([
    ['operator', operatorRole],
    ['engineer', engineerRole],
    ['chief_engineer', chiefEngineerRole],
    ['auditor', auditorRole],
  ])('does not grant Better Auth admin permissions to %s', (_role, role) => {
    expect(role.authorize({ user: ['create'] }).success).toBe(false);
    expect(role.authorize({ user: ['set-role'] }).success).toBe(false);
    expect(role.authorize({ user: ['ban'] }).success).toBe(false);
    expect(role.authorize({ user: ['delete'] }).success).toBe(false);
    expect(role.authorize({ user: ['set-password'] }).success).toBe(false);
    expect(role.authorize({ session: ['revoke'] }).success).toBe(false);
  });
});
