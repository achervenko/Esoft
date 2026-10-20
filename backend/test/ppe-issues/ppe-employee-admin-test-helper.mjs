import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const {
  EmployeesAdminService,
} = require('../../dist/src/users-admin/employees-admin.service.js');
const {
  UsersAdminAuditService,
} = require('../../dist/src/users-admin/users-admin-audit.service.js');

const {
  EmployeesAdminEditorService,
} = require('../../dist/src/users-admin/employees-admin-editor.service.js');
const {
  EmployeesAdminStatusService,
} = require('../../dist/src/users-admin/employees-admin-status.service.js');
const {
  EmployeePositionAssignmentsService,
} = require('../../dist/src/users-admin/employee-position-assignments.service.js');
export function createEmployeeAdminService(env) {
  const audit = new UsersAdminAuditService(new env.AuditLogService(env.prisma));
  return new EmployeesAdminService(
    env.prisma,
    new EmployeesAdminEditorService(
      audit,
      env.prisma,
      new EmployeePositionAssignmentsService(),
    ),
    new EmployeesAdminStatusService(audit, env.prisma),
  );
}
