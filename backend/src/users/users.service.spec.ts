import { UsersService } from './users.service';
import { getUserPermissions } from '../auth/permission-policy';
describe('user profile permissions', () => {
  const user = {
    id: 'u',
    role: 'engineer,storekeeper',
    employeeUser: null,
    photo: null,
  };
  const prisma = { user: { findUnique: jest.fn().mockResolvedValue(user) } };
  it('returns permissions for only active roles alongside assigned roles', async () => {
    const service = new UsersService(prisma as never, ['equipment']);
    expect(await service.findProfile('u')).toMatchObject({
      role: 'engineer',
      assignedRole: 'engineer,storekeeper',
      permissions: getUserPermissions('engineer'),
    });
  });
  it('returns an empty permission set if no role is active', async () => {
    const service = new UsersService(prisma as never, []);
    expect(await service.findProfile('u')).toMatchObject({
      role: '',
      assignedRole: user.role,
      permissions: [],
    });
  });
});
