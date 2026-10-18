import { DictionariesAdminController } from './dictionaries-admin.controller';
import { DictionariesAdminService } from './dictionaries-admin.service';
import { createPermissionsHttpFixture } from '../auth/permissions-http.fixture';

const resources = [
  'manufacturers',
  'models',
  'countries',
  'objects',
  'locations',
];
describe('Dictionary route ID validation', () => {
  let http: Awaited<ReturnType<typeof createPermissionsHttpFixture>>;
  const service = Object.fromEntries(
    [
      'updateManufacturer',
      'deleteManufacturer',
      'updateEquipmentModel',
      'deleteEquipmentModel',
      'updateCountry',
      'deleteCountry',
      'updateObject',
      'deleteObject',
      'updateLocation',
      'deleteLocation',
    ].map((action) => [action, jest.fn().mockResolvedValue({})]),
  );
  beforeAll(async () => {
    http = await createPermissionsHttpFixture({
      controllers: [DictionariesAdminController],
      providers: [{ provide: DictionariesAdminService, useValue: service }],
    });
  });
  afterAll(async () => {
    await http?.app.close();
  });
  beforeEach(() => {
    jest.clearAllMocks();
  });
  describe.each(resources)('%s', (resource) => {
    describe.each(['0', '-1', '9007199254740992'])('invalid ID %s', (id) => {
      it.each(['PUT', 'DELETE'])(
        'rejects %s before the service',
        async (method) => {
          const response = await http.request(
            { path: `/api/dictionaries/admin/${resource}/${id}`, method },
            'admin',
          );
          expect(response.status).toBe(400);
          expect(await response.json()).toMatchObject({
            code: 'ROUTE_ID_INVALID',
          });
          for (const mock of Object.values(service))
            expect(mock).not.toHaveBeenCalled();
        },
      );
    });
  });
});
