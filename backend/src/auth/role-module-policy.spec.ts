import optionalModuleIds from '../../prisma/module-catalog.json';
import { BadRequestException } from '@nestjs/common';
import {
  assertRoleAssignmentAvailable,
  assertRoleAvailable,
  getAssignableRoles,
  getEffectiveUserRoles,
  getUnavailableRoleModule,
  parseUserRoles,
  validateRoleTransition,
  ROLE_MODULE_REQUIREMENTS,
  USER_ROLES,
} from './role-module-policy';

function expectRoleError(operation: () => unknown, code: string) {
  let caught: unknown;
  try {
    operation();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(BadRequestException);
  expect(caught).toMatchObject({ response: { code } });
}

describe('module role policy', () => {
  it('keeps an existing operator assignment but activates it only with equipment', () => {
    const result = validateRoleTransition({
      currentRole: 'operator',
      requestedRole: 'operator,auditor',
      activeModules: [],
    });
    expect(result.value).toBe('operator,auditor');
    expect(getEffectiveUserRoles(result.value, [])).toEqual(['auditor']);
    expect(getEffectiveUserRoles(result.value, ['equipment'])).toEqual([
      'operator',
      'auditor',
    ]);
  });
  it.each([
    {
      currentRole: 'engineer,storekeeper',
      activeModules: ['equipment'],
      requestedRole: 'engineer,storekeeper',
      allowed: true,
    },
    {
      currentRole: 'engineer,storekeeper',
      activeModules: ['equipment'],
      requestedRole: 'admin,engineer,storekeeper',
      allowed: true,
    },
    {
      currentRole: 'engineer,storekeeper',
      activeModules: ['equipment'],
      requestedRole: 'engineer',
      allowed: true,
    },
    {
      currentRole: 'engineer',
      activeModules: ['equipment'],
      requestedRole: 'engineer,storekeeper',
      allowed: false,
    },
    {
      currentRole: 'storekeeper',
      activeModules: [],
      requestedRole: 'storekeeper',
      allowed: true,
    },
    {
      currentRole: 'storekeeper',
      activeModules: [],
      requestedRole: 'admin,storekeeper',
      allowed: true,
    },
    {
      currentRole: 'storekeeper',
      activeModules: [],
      requestedRole: 'admin',
      allowed: true,
    },
    {
      currentRole: 'admin',
      activeModules: [],
      requestedRole: 'admin,storekeeper',
      allowed: false,
    },
  ])(
    'validates transition $currentRole to $requestedRole with $activeModules',
    (params) => {
      if (params.allowed)
        expect(validateRoleTransition(params).value).toBe(params.requestedRole);
      else
        expectRoleError(
          () => validateRoleTransition(params),
          'ROLE_MODULE_DISABLED',
        );
    },
  );
  it('returns a canonical diff and validates only additions', () => {
    expect(
      validateRoleTransition({
        currentRole: 'storekeeper, engineer, auditor',
        requestedRole: ['storekeeper', 'admin', 'engineer', 'admin'],
        activeModules: [],
      }),
    ).toEqual({
      roles: ['admin', 'engineer', 'storekeeper'],
      addedRoles: ['admin'],
      removedRoles: ['auditor'],
      keptRoles: ['engineer', 'storekeeper'],
      value: 'admin,engineer,storekeeper',
    });
  });
  it('rejects a transition with both available and unavailable additions', () => {
    expectRoleError(
      () =>
        validateRoleTransition({
          currentRole: 'engineer',
          requestedRole: ['engineer', 'admin', 'storekeeper'],
          activeModules: ['equipment'],
        }),
      'ROLE_MODULE_DISABLED',
    );
  });
  it('rejects a disabled role after it was removed', () => {
    const removed = validateRoleTransition({
      currentRole: 'engineer,storekeeper',
      requestedRole: 'engineer',
      activeModules: ['equipment'],
    });
    expectRoleError(
      () =>
        validateRoleTransition({
          currentRole: removed.value,
          requestedRole: 'engineer,storekeeper',
          activeModules: ['equipment'],
        }),
      'ROLE_MODULE_DISABLED',
    );
  });
  it.each(
    Array.from({ length: 2 ** optionalModuleIds.length }, (_, mask) => mask),
  )('filters roles for module combination %s', (mask) => {
    const modules = optionalModuleIds.filter((_, index) => mask & (1 << index));
    const expected = ['admin', 'auditor'];
    if (modules.includes('equipment'))
      expected.push('chief_engineer', 'engineer', 'operator');
    if (modules.includes('ppe'))
      expected.push('ppe_specialist', 'accounting_specialist');
    if (modules.includes('warehouse')) expected.push('storekeeper');
    expect(getAssignableRoles(modules).sort()).toEqual(expected.sort());
    for (const role of USER_ROLES) {
      if (expected.includes(role))
        expect(() => assertRoleAvailable(role, modules)).not.toThrow();
      else
        expect(() => assertRoleAvailable(role, modules)).toThrow(
          BadRequestException,
        );
    }
  });
  it.each([
    undefined,
    null,
    '',
    'unknown',
    'constructor',
    '__proto__',
    ['admin'],
  ])('rejects invalid single role %p', (role) => {
    expect(() => assertRoleAvailable(role, [])).toThrow();
  });
  it.each([
    { role: 'admin,engineer' },
    { role: ['admin', 'engineer'] },
    { role: ['storekeeper'] },
  ])('rejects assignment $role when its module is disabled', ({ role }) => {
    expectRoleError(
      () => assertRoleAssignmentAvailable(role, []),
      'ROLE_MODULE_DISABLED',
    );
  });
  it('rejects an empty assignment independently of module availability', () => {
    expectRoleError(
      () => assertRoleAssignmentAvailable([], optionalModuleIds),
      'INVALID_ROLE',
    );
    expectRoleError(
      () => assertRoleAssignmentAvailable([], []),
      'INVALID_ROLE',
    );
  });
  it.each([
    { role: ['storekeeper', 'admin', 'storekeeper'] },
    { role: 'storekeeper,admin,storekeeper' },
  ])('normalizes $role to canonical order without duplicates', ({ role }) => {
    expect(parseUserRoles(role)).toEqual(['admin', 'storekeeper']);
  });
  it.each([
    { role: 'admin,' },
    { role: ',admin' },
    { role: 'admin,,engineer' },
    { role: ['admin', ''] },
    { role: ['admin', ' unknown '] },
  ])(
    'rejects invalid compound assignment $role even with all modules enabled',
    ({ role }) => {
      expectRoleError(
        () => assertRoleAssignmentAvailable(role, optionalModuleIds),
        'INVALID_ROLE',
      );
      expectRoleError(() => parseUserRoles(role), 'INVALID_ROLE');
    },
  );
  it('accepts whitespace around valid roles', () => {
    expect(() =>
      assertRoleAssignmentAvailable(' admin , engineer ', ['equipment']),
    ).not.toThrow();
    expect(parseUserRoles(' engineer , admin , engineer ')).toEqual([
      'admin',
      'engineer',
    ]);
    expect(parseUserRoles([' engineer ', ' admin '])).toEqual([
      'admin',
      'engineer',
    ]);
  });
  it('keeps only roles whose modules are active', () => {
    expect(
      getEffectiveUserRoles('admin,engineer,storekeeper', ['equipment']),
    ).toEqual(['admin', 'engineer']);
  });
  it('returns no effective roles when all assigned roles depend on disabled modules', () => {
    expect(getEffectiveUserRoles('engineer,storekeeper', [])).toEqual([]);
  });
  it('checks every role in a persisted compound role', () => {
    expect(getUnavailableRoleModule('admin,engineer', [])).toBe('equipment');
    expect(() =>
      assertRoleAssignmentAvailable(['admin', 'engineer'], ['equipment']),
    ).not.toThrow();
  });
  it.each(Object.entries(ROLE_MODULE_REQUIREMENTS))(
    'keeps %s inactive until its module returns',
    (role, module) => {
      expect(getUnavailableRoleModule(role, [])).toBe(module);
      expect(getUnavailableRoleModule(role, [module])).toBeUndefined();
    },
  );
});
