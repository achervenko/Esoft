import { toUserPhotoDto } from '../users/user-photo.dto';

export function toEmployeeDto(
  employee: {
    _count?: {
      employeeUsers: number;
      responsibleEquipment: number;
    };
    employeeUsers?: Array<{
      user: {
        banned?: boolean | null;
        id: string;
      };
    }>;
    firstName: string;
    id: number;
    isActive: boolean;
    lastName: string;
    middleName: string | null;
    position: string;
  },
  currentUserId?: string | null,
) {
  return {
    accountCount: employee._count?.employeeUsers ?? 0,
    activeAccountCount:
      employee.employeeUsers?.filter((item) => !item.user.banned).length ?? 0,
    equipmentCount: employee._count?.responsibleEquipment ?? 0,
    firstName: employee.firstName,
    fullName: getEmployeeFullName(employee),
    hasUserAccounts:
      (employee._count?.employeeUsers ?? employee.employeeUsers?.length ?? 0) >
      0,
    id: employee.id,
    isLinkedToCurrentUser: Boolean(
      currentUserId &&
        employee.employeeUsers?.some((item) => item.user.id === currentUserId),
    ),
    isActive: employee.isActive,
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
  photo?: {
    updatedAt: Date;
    userId: string;
  } | null;
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
    photo: toUserPhotoDto(user.photo),
    role: user.role,
    roleLabel: getRoleLabel(user.role),
    username: user.username,
  };
}

export function getRoleLabel(role: string | null | undefined) {
  const labels: Record<string, string> = {
    admin: 'Администратор',
    chief_engineer: 'Главный инженер',
    engineer: 'Инженер',
    operator: 'Оператор',
    auditor: 'Аудитор',
  };

  return role ? (labels[role] ?? role) : 'Не указана';
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
