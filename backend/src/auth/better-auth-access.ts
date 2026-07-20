import { createAccessControl } from 'better-auth/plugins/access';
import { defaultStatements } from 'better-auth/plugins/admin/access';

export const ac = createAccessControl(defaultStatements);

export const adminRole = ac.newRole({
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
});

export const operatorRole = ac.newRole({
  user: [],
  session: [],
});

export const auditorRole = ac.newRole({
  user: [],
  session: [],
});

export const chiefEngineerRole = ac.newRole({
  user: [],
  session: [],
});

export const engineerRole = ac.newRole({
  user: [],
  session: [],
});
