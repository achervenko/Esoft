import {
  createPermissionsHttpFixture,
  type HttpOperation,
} from '../auth/permissions-http.fixture';
import type { Permission } from '../auth/permission-policy';
import { PPE_PERMISSIONS } from './ppe.permissions';
import { PpeController } from './ppe.controller';
import { PpeIssuesController } from './ppe-issues.controller';
import { PpeCatalogService } from './ppe-catalog.service';
import { PpeEmployeesService } from './ppe-employees.service';
import { PpeNormsService } from './ppe-norms.service';
import { PpeIssuesService } from './ppe-issues.service';
export type Operation = HttpOperation & {
  permission: Permission;
  group: string;
  action: string;
};
export const operations: Operation[] = [
  {
    method: 'GET',
    path: '/api/ppe/norms',
    permission: PPE_PERMISSIONS.READ,
    group: 'norms',
    action: 'list',
  },
  {
    method: 'GET',
    path: '/api/ppe/norms/1',
    permission: PPE_PERMISSIONS.READ,
    group: 'norms',
    action: 'findOne',
  },
  {
    method: 'GET',
    path: '/api/ppe/positions/1/norm',
    permission: PPE_PERMISSIONS.READ,
    group: 'norms',
    action: 'findEffectiveNorm',
  },
  {
    method: 'POST',
    path: '/api/ppe/norms',
    permission: PPE_PERMISSIONS.NORMS_MANAGE,
    group: 'norms',
    action: 'create',
  },
  {
    method: 'POST',
    path: '/api/ppe/norms/1/revision',
    permission: PPE_PERMISSIONS.NORMS_MANAGE,
    group: 'norms',
    action: 'createRevision',
  },
  {
    method: 'PUT',
    path: '/api/ppe/norms/1',
    permission: PPE_PERMISSIONS.NORMS_MANAGE,
    group: 'norms',
    action: 'updateFuture',
  },
  {
    method: 'PATCH',
    path: '/api/ppe/norms/1/end',
    permission: PPE_PERMISSIONS.NORMS_MANAGE,
    group: 'norms',
    action: 'end',
  },
  {
    method: 'DELETE',
    path: '/api/ppe/norms/1',
    permission: PPE_PERMISSIONS.NORMS_MANAGE,
    group: 'norms',
    action: 'deleteFuture',
  },
  {
    method: 'GET',
    path: '/api/ppe/employees',
    permission: PPE_PERMISSIONS.READ,
    group: 'employees',
    action: 'list',
  },
  {
    method: 'GET',
    path: '/api/ppe/employees/1',
    permission: PPE_PERMISSIONS.READ,
    group: 'employees',
    action: 'findOne',
  },
  {
    method: 'PATCH',
    path: '/api/ppe/employees/1/sizes',
    permission: PPE_PERMISSIONS.EMPLOYEE_SIZES_MANAGE,
    group: 'employees',
    action: 'updateSizes',
  },
  {
    method: 'GET',
    path: '/api/ppe/positions',
    permission: PPE_PERMISSIONS.READ,
    group: 'employees',
    action: 'listPositions',
  },
  {
    method: 'GET',
    path: '/api/ppe/items',
    permission: PPE_PERMISSIONS.READ,
    group: 'catalog',
    action: 'listItems',
  },
  {
    method: 'GET',
    path: '/api/ppe/items/1',
    permission: PPE_PERMISSIONS.READ,
    group: 'catalog',
    action: 'findItem',
  },
  {
    method: 'POST',
    path: '/api/ppe/items',
    permission: PPE_PERMISSIONS.CATALOG_MANAGE,
    group: 'catalog',
    action: 'createItem',
  },
  {
    method: 'PUT',
    path: '/api/ppe/items/1',
    permission: PPE_PERMISSIONS.CATALOG_MANAGE,
    group: 'catalog',
    action: 'updateItem',
  },
  {
    method: 'PATCH',
    path: '/api/ppe/items/1/status',
    permission: PPE_PERMISSIONS.CATALOG_MANAGE,
    group: 'catalog',
    action: 'setItemStatus',
  },
  {
    method: 'GET',
    path: '/api/ppe/items/1/sizes',
    permission: PPE_PERMISSIONS.READ,
    group: 'catalog',
    action: 'listSizes',
  },
  {
    method: 'POST',
    path: '/api/ppe/items/1/sizes',
    permission: PPE_PERMISSIONS.CATALOG_MANAGE,
    group: 'catalog',
    action: 'createSize',
  },
  {
    method: 'PUT',
    path: '/api/ppe/items/1/sizes',
    permission: PPE_PERMISSIONS.CATALOG_MANAGE,
    group: 'catalog',
    action: 'replaceSizes',
  },
  {
    method: 'PUT',
    path: '/api/ppe/items/1/sizes/1',
    permission: PPE_PERMISSIONS.CATALOG_MANAGE,
    group: 'catalog',
    action: 'updateSize',
  },
  {
    method: 'PATCH',
    path: '/api/ppe/items/1/sizes/1/status',
    permission: PPE_PERMISSIONS.CATALOG_MANAGE,
    group: 'catalog',
    action: 'setSizeStatus',
  },
  {
    method: 'GET',
    path: '/api/ppe/employees/1/items/1/size-recommendation',
    permission: PPE_PERMISSIONS.READ,
    group: 'issues',
    action: 'recommendSize',
  },
  {
    method: 'GET',
    path: '/api/ppe/employees/1/issues/plan',
    permission: PPE_PERMISSIONS.READ,
    group: 'issues',
    action: 'plan',
  },
  {
    method: 'GET',
    path: '/api/ppe/issues',
    permission: PPE_PERMISSIONS.READ,
    group: 'issues',
    action: 'list',
  },
  {
    method: 'GET',
    path: '/api/ppe/issues/page',
    permission: PPE_PERMISSIONS.READ,
    group: 'issues',
    action: 'listPage',
  },
  {
    method: 'GET',
    path: '/api/ppe/issues/1',
    permission: PPE_PERMISSIONS.READ,
    group: 'issues',
    action: 'findOne',
  },
  {
    method: 'POST',
    path: '/api/ppe/issues/regular',
    permission: PPE_PERMISSIONS.ISSUE,
    group: 'issues',
    action: 'createRegular',
  },
  {
    method: 'POST',
    path: '/api/ppe/issues/extra',
    permission: PPE_PERMISSIONS.ISSUE,
    group: 'issues',
    action: 'createExtra',
  },
  {
    method: 'POST',
    path: '/api/ppe/issues/1/cancel',
    permission: PPE_PERMISSIONS.ISSUE,
    group: 'issues',
    action: 'cancel',
  },
];

export async function createPpeHttpFixture() {
  const services: Record<
    string,
    Record<string, jest.Mock<Promise<object>, unknown[]>>
  > = {};
  for (const { group, action } of operations) {
    services[group] ??= {};
    services[group][action] = jest
      .fn<Promise<object>, unknown[]>()
      .mockResolvedValue({});
  }
  const http = await createPermissionsHttpFixture({
    controllers: [PpeController, PpeIssuesController],
    providers: [
      { provide: PpeCatalogService, useValue: services.catalog },
      { provide: PpeEmployeesService, useValue: services.employees },
      { provide: PpeNormsService, useValue: services.norms },
      { provide: PpeIssuesService, useValue: services.issues },
    ],
  });
  return {
    ...http,
    services,
    request(operation: HttpOperation, role?: string, body: unknown = {}) {
      return http.request(
        operation.method === 'GET' ? operation : { ...operation, body },
        role,
      );
    },
    expectNoServiceCalls() {
      for (const service of Object.values(services))
        for (const mock of Object.values(service))
          expect(mock).not.toHaveBeenCalled();
    },
  };
}
