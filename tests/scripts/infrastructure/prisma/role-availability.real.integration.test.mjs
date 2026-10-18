import assert from 'node:assert/strict';
import { cp, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { betterAuth } from 'better-auth';
import { admin, customSession } from 'better-auth/plugins';
import { createIsolatedPostgres } from '../../helpers/isolated-postgres.mjs';
import { runPackageMigrations } from '../../../../scripts/database/migrate.mjs';

const require = createRequire(import.meta.url);
const project = resolve(import.meta.dirname, '../../../..');

test('ESOFT and Better Auth share atomic role transitions, normalization and effective sessions', {
  skip: process.env.ESOFT_MODULAR_MIGRATION_TEST !== '1', timeout: 120000,
}, async () => {
  const { PrismaClient } = require('@prisma/client');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const { createRoleAvailabilityHooks, createRoleRequestHook } = require('../../../../backend/dist/src/auth/role-availability.hooks.js');
  const { roleAwarePrismaAdapter } = require('../../../../backend/dist/src/auth/role-aware-prisma-adapter.js');
  const access = require('../../../../backend/dist/src/auth/better-auth-access.js');
  const { withEffectiveRoles } = require('../../../../backend/dist/src/auth/effective-session.js');
  const { countOtherActiveAdmins } = require('../../../../backend/dist/src/auth/role-sql.js');
  const environment = await createIsolatedPostgres();
  try {
    const root = join(environment.root, 'role_policy');
    await mkdir(join(root, 'backend/prisma/packages'), { recursive: true });
    await cp(join(project, 'backend/prisma/packages/core'), join(root, 'backend/prisma/packages/core'), { recursive: true });
    await cp(join(project, 'backend/prisma/schema'), join(root, 'backend/prisma/schema'), { recursive: true });
    await writeFile(join(root, 'database-packages.json'), '{"modules":[]}');
    await environment.database('role_policy');
    const url = environment.urlFor('role_policy');
    const migration = await runPackageMigrations({ projectRoot: root, databaseUrl: url, operation: 'deploy', output: { log() {} } });
    assert.equal(migration.ok, true, migration.stdout + migration.stderr);
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
    const roles = { admin: access.adminRole, operator: access.operatorRole, auditor: access.auditorRole, engineer: access.engineerRole, chief_engineer: access.chiefEngineerRole, ppe_specialist: access.ppeSpecialistRole, accounting_specialist: access.accountingSpecialistRole, storekeeper: access.storekeeperRole };
    const makeAuth = (modules) => betterAuth({
      baseURL: 'http://localhost:3000', secret: 'isolated-role-policy-test-secret-at-least-32-characters',
      database: roleAwarePrismaAdapter(prisma, modules),
      hooks: { before: createRoleRequestHook() },
      databaseHooks: createRoleAvailabilityHooks(modules),
      emailAndPassword: { enabled: true },
      plugins: [customSession((value) => Promise.resolve(withEffectiveRoles(value, modules))), admin({ ac: access.ac, defaultRole: 'operator', roles })],
    });
    try {
      const auth = makeAuth([]);
      await auth.api.createUser({ body: { name: 'Admin', email: 'admin@roles.test', password: 'Secure-test-password-123!', role: 'admin' } });
      const target = await auth.api.createUser({ body: { name: 'Target', email: 'target@roles.test', password: 'Secure-target-password-123!', role: 'auditor' } });
      assert.equal(target.user.role, 'auditor');
      const signedIn = await auth.api.signInEmail({ body: { email: 'admin@roles.test', password: 'Secure-test-password-123!' }, returnHeaders: true });
      const cookie = signedIn.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
      assert.ok(cookie);
      const headers = new Headers({ cookie });
      const blocked = (error) => error.body?.code === 'ROLE_MODULE_DISABLED';
      await assert.rejects(auth.api.createUser({ headers, body: { name: 'Default operator', email: 'default-blocked@roles.test' } }), blocked);
      for (const role of ['engineer', 'chief_engineer', 'operator', 'ppe_specialist', 'accounting_specialist', 'storekeeper']) {
        await assert.rejects(auth.api.setRole({ headers, body: { userId: target.user.id, role } }), blocked);
        await assert.rejects(auth.api.setRole({ headers, body: { userId: target.user.id, role: ['admin', role] } }), blocked);
        await assert.rejects(auth.api.adminUpdateUser({ headers, body: { userId: target.user.id, data: { role } } }), blocked);
        await assert.rejects(auth.api.createUser({ headers, body: { name: 'Blocked', email: `${role}@roles.test`, role } }), blocked);
        await assert.rejects(auth.api.createUser({ headers, body: { name: 'Blocked', email: `${role}@roles.test`, data: { role } } }), blocked);
      }
      assert.equal(await prisma.user.count(), 2);
      assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: target.user.id } })).role, 'auditor');
      const enabled = makeAuth(['equipment', 'ppe', 'warehouse']);
      assert.equal((await enabled.api.createUser({ headers, body: { name: 'Default operator', email: 'default-operator@roles.test' } })).user.role, 'operator');
      for (const role of Object.keys(roles)) {
        await enabled.api.setRole({ headers, body: { userId: target.user.id, role } });
        assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: target.user.id } })).role, role);
      }
      await auth.api.adminUpdateUser({ headers, body: { userId: target.user.id, data: { name: 'Preserved role' } } });
      assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: target.user.id } })).role, 'storekeeper');
      await enabled.api.setRole({ headers, body: { userId: target.user.id, role: ['storekeeper', 'engineer', 'engineer'] } });
      assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: target.user.id } })).role, 'engineer,storekeeper');
      const targetLogin = await enabled.api.signInEmail({ body: { email: 'target@roles.test', password: 'Secure-target-password-123!' }, returnHeaders: true });
      const targetCookie = targetLogin.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
      const targetHeaders = new Headers({ cookie: targetCookie });
      for (const modules of [[], ['equipment'], ['warehouse'], ['equipment', 'warehouse']]) {
        const instance = makeAuth(modules);
        const session = await instance.api.getSession({ headers: targetHeaders });
        assert.equal(session.user.assignedRole, 'engineer,storekeeper');
        assert.equal(session.user.role, [modules.includes('equipment') ? 'engineer' : '', modules.includes('warehouse') ? 'storekeeper' : ''].filter(Boolean).join(','));
      }
      // Whole-token matching must neither lose compound admins nor match superadmin.
      await prisma.user.update({ where: { id: target.user.id }, data: { role: ' engineer , admin ' } });
      assert.equal(await countOtherActiveAdmins(prisma, 'nonexistent'), 2);
      assert.equal(await countOtherActiveAdmins(prisma, target.user.id), 1);
      await prisma.user.update({ where: { id: target.user.id }, data: { role: 'superadmin,engineer' } });
      assert.equal(await countOtherActiveAdmins(prisma, 'nonexistent'), 1);
      const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@roles.test' } });
      const position = await prisma.position.create({ data: { name: 'Role test' } });
      const employee = await prisma.employee.create({ data: { firstName: 'Role', lastName: 'Test', positionId: position.id } });
      await prisma.employeeUser.createMany({ data: [adminUser.id, target.user.id].map((userId) => ({ userId, employeeId: employee.id })) });
      const { AuditLogService } = require('../../../../backend/dist/src/audit/audit-log.service.js');
      const { UsersAdminAuditService } = require('../../../../backend/dist/src/users-admin/users-admin-audit.service.js');
      const { UsersAdminAssertionsService } = require('../../../../backend/dist/src/users-admin/users-admin-assertions.service.js');
      const { UserAccountsAdminService } = require('../../../../backend/dist/src/users-admin/user-accounts-admin.service.js');
      const { UserStatusAdminService } = require('../../../../backend/dist/src/users-admin/user-status-admin.service.js');
      const { SetupStateService } = require('../../../../backend/dist/src/setup/setup-state.service.js');
      const { EventsAccessAssertions } = require('../../../../backend/dist/src/events/events-access.assertions.js');
      const audit = new UsersAdminAuditService(new AuditLogService(prisma));
      const accounts = new UserAccountsAdminService(new UsersAdminAssertionsService(prisma), audit, prisma, ['equipment']);
      const status = new UserStatusAdminService(audit, prisma);
      const payload = { email: 'target@roles.test', username: 'target', employeeId: employee.id };
      await prisma.user.update({ where: { id: target.user.id }, data: { role: 'engineer,storekeeper' } });
      const retained = await accounts.updateUser(target.user.id, { ...payload, role: ['storekeeper', 'engineer', 'auditor'] }, adminUser.id);
      assert.equal(retained.role, 'engineer,auditor,storekeeper');
      await accounts.updateUser(target.user.id, { ...payload, role: ['engineer', 'auditor'] }, adminUser.id);
      await assert.rejects(accounts.updateUser(target.user.id, { ...payload, role: 'engineer,storekeeper' }, adminUser.id), (error) => error.response?.code === 'ROLE_MODULE_DISABLED');
      await assert.rejects(accounts.updateUser(target.user.id, { ...payload, role: 'engineer' }, target.user.id), (error) => error.response?.code === 'CANNOT_CHANGE_OWN_ROLE');
      await prisma.$transaction((tx) => new EventsAccessAssertions(['equipment']).assertResponsibleUsersExist(tx, [target.user.id]));
      await assert.rejects(prisma.$transaction((tx) => new EventsAccessAssertions([]).assertResponsibleUsersExist(tx, [target.user.id])), (error) => error.response?.code === 'RESPONSIBLE_USER_INACTIVE');
      await prisma.user.update({ where: { id: adminUser.id }, data: { role: 'admin,engineer' } });
      assert.equal(await new SetupStateService(prisma).hasActiveAdministrator(), true);
      await assert.rejects(accounts.updateUser(adminUser.id, { email: adminUser.email, username: 'admin', employeeId: employee.id, role: 'operator' }, target.user.id), (error) => error.response?.code === 'LAST_ACTIVE_ADMIN_ROLE_REQUIRED');
      await assert.rejects(status.setUserStatus({ userId: adminUser.id, currentUserId: target.user.id, banned: true }), (error) => error.response?.code === 'LAST_ACTIVE_ADMIN_STATUS_REQUIRED');
      // Better Auth transaction adapters must retain the same mutation policy.
      const adapter = (await makeAuth(['equipment']).$context).adapter;
      await prisma.user.update({ where: { id: target.user.id }, data: { role: 'engineer,storekeeper', name: 'Before adapter transaction' } });
      await adapter.transaction(async (tx) => {
        const updated = await tx.update({ model: 'user', where: [{ field: 'id', value: target.user.id }], update: { role: ['storekeeper', 'admin', 'engineer'] } });
        assert.equal(updated.role, 'admin,engineer,storekeeper');
      });
      const aborted = new Error('Rollback adapter transaction');
      await assert.rejects(adapter.transaction(async (tx) => {
        await tx.update({ model: 'user', where: [{ field: 'id', value: target.user.id }], update: { role: 'engineer', name: 'Must roll back' } });
        throw aborted;
      }), (error) => error === aborted);
      const afterRollback = await prisma.user.findUniqueOrThrow({ where: { id: target.user.id } });
      assert.equal(afterRollback.role, 'admin,engineer,storekeeper');
      assert.equal(afterRollback.name, 'Before adapter transaction');
      assert.throws(() => adapter.updateMany({ model: 'user', where: [], update: { role: 'storekeeper' } }), (error) => error.body?.code === 'ROLE_BULK_UPDATE_NOT_SUPPORTED');
    } finally { await prisma.$disconnect(); }
  } finally { await environment.close(); }
});
