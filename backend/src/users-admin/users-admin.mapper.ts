export function toEmployeeDto(employee: {
  _count?: {
    employeeUsers: number;
    responsibleEquipment: number;
  };
  firstName: string;
  id: number;
  lastName: string;
  middleName: string | null;
  position: string;
}) {
  return {
    accountCount: employee._count?.employeeUsers ?? 0,
    equipmentCount: employee._count?.responsibleEquipment ?? 0,
    firstName: employee.firstName,
    fullName: getEmployeeFullName(employee),
    id: employee.id,
    lastName: employee.lastName,
    middleName: employee.middleName,
    position: employee.position,
  };
}

type AdminUserForDto = {
  banned: boolean | null;
  createdAt: Date;
  displayUsername: string | null;
  email: string;
  employeeUser?: {
    employee: {
      firstName: string;
      id: number;
      lastName: string;
      middleName: string | null;
      position: string;
    };
  } | null;
  id: string;
  lastLoginAt: Date | null;
  name: string;
  role: string | null;
  sessions?: Array<{
    createdAt: Date;
  }>;
  username: string | null;
};

export function toAdminUserDto(user: AdminUserForDto) {
  const employee = user.employeeUser?.employee ?? null;
  const lastLoginAt = user.lastLoginAt ?? user.sessions?.[0]?.createdAt ?? null;

  return {
    banned: Boolean(user.banned),
    createdAt: user.createdAt,
    displayUsername: user.displayUsername,
    email: user.email,
    employee: employee
      ? {
          fullName: getEmployeeFullName(employee),
          id: employee.id,
          position: employee.position,
        }
      : null,
    id: user.id,
    lastLoginAt,
    name: user.name,
    role: user.role,
    roleLabel: getRoleLabel(user.role),
    username: user.username,
  };
}

export function getRoleLabel(role: string | null | undefined) {
  const labels: Record<string, string> = {
    admin: '\u0410\u0434\u043c\u0438\u043d',
    chief_engineer:
      '\u0413\u043b\u0430\u0432\u043d\u044b\u0439 \u0438\u043d\u0436\u0435\u043d\u0435\u0440',
    engineer: '\u0418\u043d\u0436\u0435\u043d\u0435\u0440',
    operator: '\u041e\u043f\u0435\u0440\u0430\u0442\u043e\u0440',
    auditor: '\u0410\u0443\u0434\u0438\u0442\u043e\u0440',
  };

  return role
    ? (labels[role] ?? role)
    : '\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u0430';
}

function getEmployeeFullName(employee: {
  firstName: string;
  lastName: string;
  middleName: string | null;
}) {
  return [employee.lastName, employee.firstName, employee.middleName]
    .filter(Boolean)
    .join(' ');
}
