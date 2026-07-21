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
  password?: unknown;
  passwordConfirmation?: unknown;
  username?: unknown;
};

export type CreateInitialAdminInput = {
  email: string;
  employeeId: number;
  password: string;
  username: string;
};

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
