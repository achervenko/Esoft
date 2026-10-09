export type SetupStatusDto = {
  setupRequired: boolean;
};

export type SetupEmployeeDto = {
  fullName: string;
  id: number;
  position: string;
};

export type CreateInitialAdminDto = {
  email?: unknown;
  employeeId?: unknown;
  employee?: unknown;
  password?: unknown;
  passwordConfirmation?: unknown;
  username?: unknown;
};

export type SetupNewEmployee = {
  lastName: string;
  firstName: string;
  middleName: string | null;
};

export type CreateInitialAdminInput = {
  email: string;
  password: string;
  username: string;
} & (
  | { employeeId: number; employee?: never }
  | { employee: SetupNewEmployee; employeeId?: never }
);

export type SetupRequestMeta = {
  ipAddress?: string | null;
  origin?: string | null;
  userAgent?: string | null;
};

export type ActiveAdminRow = {
  id: string;
};

export type SetupEmployeeRow = {
  first_name: string;
  id: number;
  last_name: string;
  middle_name: string | null;
  position: string;
};

export function formatSetupEmployeeFullName(employee: SetupEmployeeRow) {
  return [employee.last_name, employee.first_name, employee.middle_name]
    .filter(Boolean)
    .join(' ');
}
