import { expect, it } from 'vitest';
import { hasPermission } from './permissions';
import { canAccessWorkspaceRoute } from '../../lib/role-navigation';
import { canManagePpeCatalog } from '../../modules/ppe-permissions/ppe-permissions';
import { canEditEquipment } from '../../modules/equipment-permissions/equipment-permissions';

it('uses explicit API permissions without inferring grants from role names', () => {
 expect(hasPermission(['equipment.edit'], 'equipment.edit')).toBe(true);
 expect(canEditEquipment(['equipment.edit'])).toBe(true);
 expect(canEditEquipment(['equipment.read'])).toBe(false);
 expect(canManagePpeCatalog(['ppe.catalog.manage'])).toBe(true);
 for (const input of ['admin', 'admin,engineer', null, undefined, {}, ['admin']]) {
   expect(canEditEquipment(input)).toBe(false);
   expect(canManagePpeCatalog(input)).toBe(false);
 }
});
it('checks each route against its permission independently', () => {
 const permissions = ['users.profile.read', 'calendar.read', 'checklists.work'];
 expect(canAccessWorkspaceRoute(permissions, '#/calendar')).toBe(true);
 expect(canAccessWorkspaceRoute(permissions, '#/my-checklists')).toBe(true);
 for (const route of ['#/equipment', '#/production-calendar', '#/users', '#/ppe', '#/search']) expect(canAccessWorkspaceRoute(permissions, route)).toBe(false);
 expect(canAccessWorkspaceRoute([], '#/profile')).toBe(false);
});

it('does not conflate dictionary, user-management and file permissions', async () => {
 const { getProfilePermissionAccess, getProfileModuleAccess } = await import('../../modules/user-profile/profile-access');
 const permissions = ['dictionaries.manage', 'files.manage'];
 expect(getProfilePermissionAccess(permissions).find(item => item.title === 'Управление справочниками')?.allowed).toBe(true);
 expect(getProfilePermissionAccess(permissions).find(item => item.title === 'Управление пользователями')?.allowed).toBe(false);
 expect(getProfileModuleAccess(permissions).map(item => item.title)).toEqual(['Документы оборудования', 'Справочники']);
});
