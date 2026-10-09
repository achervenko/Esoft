export type SetupStatus = {
  setupRequired: boolean;
};

export type SetupEmployee = {
  fullName: string;
  id: number;
  position: string;
};

export type CreateInitialAdminPayload = {
  email: string;
  employeeId?: number;
  employee?: { lastName: string; firstName: string; middleName: string | null };
  password: string;
  passwordConfirmation: string;
  username: string;
};
