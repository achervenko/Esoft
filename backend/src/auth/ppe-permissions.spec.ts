import { USER_ROLES } from './role-module-policy';
import { hasPermission } from './permission-policy';
import { ForbiddenException } from '@nestjs/common';
import {
  canReadPpe,
  canBackdatePpeIssue,
  assertCanViewUserProfile,
} from './role-permissions';
import { getRoleLabel } from '../users-admin/users-admin.mapper';
import { parseUpdateUserPayload } from '../users-admin/users-admin.validation';

describe('PPE permissions', () => {
  it('allows accounting issuance and catalog but denies sizes, norm changes and backdating', () => {
    expect(canReadPpe('accounting_specialist')).toBe(true);
    expect(hasPermission('accounting_specialist', 'ppe.catalog.manage')).toBe(
      true,
    );
    expect(hasPermission('accounting_specialist', 'ppe.issue')).toBe(true);
    expect(
      hasPermission('accounting_specialist', 'ppe.employee-sizes.manage'),
    ).toBe(false);
    expect(hasPermission('accounting_specialist', 'ppe.norms.manage')).toBe(
      false,
    );
    expect(hasPermission('accounting_specialist', 'users.manage')).toBe(false);
    expect(canBackdatePpeIssue('accounting_specialist')).toBe(false);
  });
  it.each(USER_ROLES)(
    'allows explicit issue dates only for the admin role: %s',
    (role) => {
      expect(canBackdatePpeIssue(role)).toBe(role === 'admin');
      expect(canBackdatePpeIssue(role)).toBe(
        hasPermission(role, 'ppe.issue.backdate'),
      );
    },
  );
  it.each(['unknown', null, undefined])(
    'denies backdate for invalid role %p',
    (role) => {
      expect(canBackdatePpeIssue(role)).toBe(false);
    },
  );
  it('grants expected PPE capabilities to admin', () => {
    expect(canReadPpe('admin')).toBe(true);
    expect(hasPermission('admin', 'ppe.catalog.manage')).toBe(true);
    expect(hasPermission('admin', 'ppe.employee-sizes.manage')).toBe(true);
    expect(hasPermission('admin', 'ppe.norms.manage')).toBe(true);
    expect(hasPermission('admin', 'ppe.issue')).toBe(true);
  });

  it('grants only safety-specialist PPE capabilities', () => {
    expect(canReadPpe('ppe_specialist')).toBe(true);
    expect(hasPermission('ppe_specialist', 'ppe.catalog.manage')).toBe(false);
    expect(hasPermission('ppe_specialist', 'ppe.employee-sizes.manage')).toBe(
      true,
    );
    expect(hasPermission('ppe_specialist', 'ppe.norms.manage')).toBe(true);
    expect(hasPermission('ppe_specialist', 'ppe.issue')).toBe(false);
  });

  it('does not grant other module administrative permissions', () => {
    expect(hasPermission('ppe_specialist', 'users.manage')).toBe(false);
    expect(hasPermission('admin', 'users.manage')).toBe(true);
    expect(() =>
      assertCanViewUserProfile({
        currentUserId: 'ppe',
        requestedUserId: 'other',
        role: 'ppe_specialist',
      }),
    ).toThrow(ForbiddenException);
  });

  it('accepts the role for account management and supplies its display name', () => {
    expect(
      parseUpdateUserPayload({
        email: 'ppe@example.com',
        username: 'ppe-user',
        employeeId: 1,
        role: 'ppe_specialist',
      }).role,
    ).toBe('ppe_specialist');
    expect(getRoleLabel('ppe_specialist')).toBe('Специалист по охране труда');
  });
});
