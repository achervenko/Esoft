import { ForbiddenException } from '@nestjs/common';
import {
  canReadPpe,
  canManagePpeCatalog,
  canManageEmployeeSizes,
  canManagePpeNorms,
  canIssuePpe,
  canBackdatePpeIssue,
  assertCanReadPpe,
  assertCanManagePpeCatalog,
  assertCanManageEmployeeSizes,
  assertCanManagePpeNorms,
  assertCanIssuePpe,
  assertAdmin,
  assertCanEditEquipment,
  assertCanManageFiles,
  assertCanManageEvents,
  assertCanManageEquipmentEvents,
  assertCanManageChecklists,
  assertCanAccessCalendar,
  assertCanViewUserProfile,
} from './role-permissions';
import { getRoleLabel } from '../users-admin/users-admin.mapper';
import { parseUpdateUserPayload } from '../users-admin/users-admin.validation';

const capabilities = [
  canReadPpe,
  canManagePpeCatalog,
  canManageEmployeeSizes,
  canManagePpeNorms,
  canIssuePpe,
];
const assertions = [
  assertCanReadPpe,
  assertCanManagePpeCatalog,
  assertCanManageEmployeeSizes,
  assertCanManagePpeNorms,
  assertCanIssuePpe,
];

describe('PPE permissions', () => {
  it('allows accounting issuance and catalog but denies sizes, norm changes and backdating', () => {
    expect(canReadPpe('accounting_specialist')).toBe(true);
    expect(canManagePpeCatalog('accounting_specialist')).toBe(true);
    expect(canIssuePpe('accounting_specialist')).toBe(true);
    expect(() => assertCanManageEmployeeSizes('accounting_specialist')).toThrow(
      ForbiddenException,
    );
    expect(() => assertCanManagePpeNorms('accounting_specialist')).toThrow(
      ForbiddenException,
    );
    expect(() => assertAdmin('accounting_specialist')).toThrow(
      ForbiddenException,
    );
    expect(canBackdatePpeIssue('accounting_specialist')).toBe(false);
  });
  it('allows explicit issue dates only for admin independently of issue permission', () => {
    expect(canBackdatePpeIssue('admin')).toBe(true);
    for (const role of [
      'ppe_specialist',
      'engineer',
      'unknown',
      null,
      undefined,
    ])
      expect(canBackdatePpeIssue(role)).toBe(false);
    expect(canIssuePpe('ppe_specialist')).toBe(false);
  });
  it.each(['admin', 'ppe_specialist'])(
    'grants PPE capabilities to %s',
    (role) => {
      for (const can of capabilities)
        expect(can(role)).toBe(role === 'admin' || can !== canIssuePpe);
      for (const assertAllowed of assertions)
        if (role === 'ppe_specialist' && assertAllowed === assertCanIssuePpe)
          expect(() => assertAllowed(role)).toThrow(ForbiddenException);
        else expect(() => assertAllowed(role)).not.toThrow();
    },
  );

  it.each([
    'chief_engineer',
    'engineer',
    'operator',
    'auditor',
    'PPE_SPECIALIST',
    'unknown',
    null,
    undefined,
  ])('denies PPE capabilities to %s', (role) => {
    for (const can of capabilities) expect(can(role)).toBe(false);
    for (const assertAllowed of assertions)
      expect(() => assertAllowed(role)).toThrow(ForbiddenException);
  });

  it('does not grant other module administrative permissions', () => {
    for (const check of [
      assertAdmin,
      assertCanEditEquipment,
      assertCanManageFiles,
      assertCanManageEvents,
      assertCanManageEquipmentEvents,
      assertCanManageChecklists,
      assertCanAccessCalendar,
    ]) {
      expect(() => check('ppe_specialist')).toThrow(ForbiddenException);
      expect(() => check('admin')).not.toThrow();
    }
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
