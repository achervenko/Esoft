import { hasPermission } from '../auth/permission-policy';
import { USER_ROLES, getEffectiveUserRoles } from '../auth/role-module-policy';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserPhotoService } from './user-photo.service';
import { createPermissionsHttpFixture } from '../auth/permissions-http.fixture';

const suffixes = ['profile', 'photo/small'];
describe('User profile and photo authorization through the global guard', () => {
  let http: Awaited<ReturnType<typeof createPermissionsHttpFixture>>;
  const profiles = {
    findProfile: jest.fn().mockResolvedValue({ id: 'actor' }),
  };
  const photos = {
    getPhotoObject: jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve({ body: Buffer.from('photo'), contentLength: 5 }),
      ),
  };
  beforeAll(async () => {
    http = await createPermissionsHttpFixture({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: profiles },
        { provide: UserPhotoService, useValue: photos },
      ],
    });
  });
  afterAll(async () => {
    await http?.app.close();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    http.modules.splice(
      0,
      http.modules.length,
      'equipment',
      'ppe',
      'warehouse',
    );
  });
  function request(id: string, suffix: string, role?: string) {
    return http.request(
      { path: `/api/users/${id}/${suffix}`, method: 'GET' },
      role,
    );
  }
  function expectNoServiceCalls() {
    expect(profiles.findProfile).not.toHaveBeenCalled();
    expect(photos.getPhotoObject).not.toHaveBeenCalled();
  }
  describe.each([...USER_ROLES, 'engineer,storekeeper', 'admin,storekeeper'])(
    'role %s',
    (role) => {
      it.each(suffixes)('checks permission for own %s', async (suffix) => {
        const effectiveRole = getEffectiveUserRoles(role, http.modules).join(
          ',',
        );
        const allowed = hasPermission(effectiveRole, 'users.profile.read');
        expect((await request('actor', suffix, role)).status).toBe(
          allowed ? 200 : 403,
        );
        if (!allowed) expectNoServiceCalls();
        else if (suffix === 'profile')
          expect(profiles.findProfile).toHaveBeenCalledWith('actor');
        else
          expect(photos.getPhotoObject).toHaveBeenCalledWith('actor', 'small');
      });
      it.each(suffixes)(
        'checks ownership for another user: %s',
        async (suffix) => {
          const effectiveRole = getEffectiveUserRoles(role, http.modules).join(
            ',',
          );
          const allowed =
            hasPermission(effectiveRole, 'users.profile.read') &&
            hasPermission(effectiveRole, 'users.manage');
          expect((await request('other', suffix, role)).status).toBe(
            allowed ? 200 : 403,
          );
          if (!allowed) expectNoServiceCalls();
          else if (suffix === 'profile')
            expect(profiles.findProfile).toHaveBeenCalledWith('other');
          else
            expect(photos.getPhotoObject).toHaveBeenCalledWith(
              'other',
              'small',
            );
        },
      );
    },
  );
  it.each(suffixes)('requires authentication for %s', async (suffix) => {
    expect((await request('actor', suffix)).status).toBe(401);
    expectNoServiceCalls();
  });
  it.each(suffixes)('denies own %s without effective roles', async (suffix) => {
    http.modules.splice(0);
    expect(
      (await request('actor', suffix, 'engineer,storekeeper')).status,
    ).toBe(403);
    expectNoServiceCalls();
  });
  it('preserves photo streaming headers and content', async () => {
    const photo = await request('actor', 'photo/small', 'storekeeper');
    expect(await photo.text()).toBe('photo');
    expect(photo.headers.get('content-type')).toBe('image/webp');
    expect(photo.headers.get('cache-control')).toBe('private, max-age=3600');
    expect(photos.getPhotoObject).toHaveBeenCalledWith('actor', 'small');
  });
  it('checks ownership before validating photo size', async () => {
    expect(
      (await request('actor', 'photo/invalid', 'storekeeper')).status,
    ).toBe(400);
    expect(
      (await request('other', 'photo/invalid', 'storekeeper')).status,
    ).toBe(403);
    expectNoServiceCalls();
  });
});
