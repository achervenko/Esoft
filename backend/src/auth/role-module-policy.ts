import { BadRequestException } from '@nestjs/common';

export const USER_ROLES = [
  'admin',
  'chief_engineer',
  'engineer',
  'operator',
  'auditor',
  'ppe_specialist',
  'accounting_specialist',
  'storekeeper',
] as const;
export type AppRole = (typeof USER_ROLES)[number];

export function getUserRoles(role: unknown): AppRole[] {
  if (typeof role !== 'string') return [];
  return [
    ...new Set(
      role
        .split(',')
        .map((value) => value.trim())
        .filter((value): value is AppRole =>
          (USER_ROLES as readonly string[]).includes(value),
        ),
    ),
  ];
}

export function hasRole(role: unknown, target: AppRole) {
  return getUserRoles(role).includes(target);
}

export function validateRoleTransition(params: {
  currentRole: unknown;
  requestedRole: unknown;
  activeModules: readonly string[];
}) {
  const roles = parseUserRoles(params.requestedRole);
  const previous = getUserRoles(params.currentRole);
  const addedRoles = roles.filter((role) => !previous.includes(role));
  const removedRoles = previous.filter((role) => !roles.includes(role));
  const keptRoles = roles.filter((role) => previous.includes(role));
  for (const role of addedRoles)
    assertRoleAvailable(role, params.activeModules);
  return { roles, addedRoles, removedRoles, keptRoles, value: roles.join(',') };
}

// Assignment is strict: unknown or empty tokens must never be silently discarded.
export function parseUserRoles(value: unknown): AppRole[] {
  const values: unknown[] =
    typeof value === 'string'
      ? value.split(',')
      : Array.isArray(value)
        ? value
        : [];
  if (
    !values.length ||
    values.some(
      (role) =>
        typeof role !== 'string' ||
        !(USER_ROLES as readonly string[]).includes(role.trim()),
    )
  ) {
    throw new BadRequestException({
      code: 'INVALID_ROLE',
      message: 'Выберите допустимые роли.',
    });
  }
  const selected = values.map((role) => (role as string).trim());
  return USER_ROLES.filter((role) => selected.includes(role));
}

export function getEffectiveUserRoles(
  role: unknown,
  activeModules: readonly string[],
): AppRole[] {
  return getUserRoles(role).filter((value) => {
    const module = requiredModule(value);
    return !module || activeModules.includes(module);
  });
}

export const ROLE_MODULE_REQUIREMENTS = {
  chief_engineer: 'equipment',
  engineer: 'equipment',
  operator: 'equipment',
  ppe_specialist: 'ppe',
  accounting_specialist: 'ppe',
  storekeeper: 'warehouse',
} as const satisfies Partial<Record<AppRole, string>>;

function requiredModule(role: string): string | undefined {
  return Object.prototype.hasOwnProperty.call(ROLE_MODULE_REQUIREMENTS, role)
    ? ROLE_MODULE_REQUIREMENTS[role as keyof typeof ROLE_MODULE_REQUIREMENTS]
    : undefined;
}

export function getUnavailableRoleModule(
  role: unknown,
  activeModules: readonly string[],
) {
  for (const value of getUserRoles(role)) {
    const module = requiredModule(value);
    if (module && !activeModules.includes(module)) return module;
  }
  return undefined;
}

export function getAssignableRoles(
  activeModules: readonly string[],
): AppRole[] {
  return USER_ROLES.filter(
    (role) => !getUnavailableRoleModule(role, activeModules),
  );
}

export function assertRoleAvailable(
  role: unknown,
  activeModules: readonly string[],
): asserts role is AppRole {
  if (
    typeof role !== 'string' ||
    !(USER_ROLES as readonly string[]).includes(role)
  )
    throw new BadRequestException({
      code: 'INVALID_ROLE',
      message: 'Неизвестная роль.',
    });
  const module = getUnavailableRoleModule(role, activeModules);
  if (module)
    throw new BadRequestException({
      code: 'ROLE_MODULE_DISABLED',
      message: `Для назначения роли требуется модуль ${module}.`,
    });
}

// Better Auth accepts role arrays and persists them as a comma-separated string.
export function assertRoleAssignmentAvailable(
  value: unknown,
  activeModules: readonly string[],
) {
  validateRoleTransition({
    currentRole: null,
    requestedRole: value,
    activeModules,
  });
}
