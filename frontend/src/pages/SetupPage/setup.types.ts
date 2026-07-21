export type SetupFormState = {
  email: string;
  employeeId: string;
  password: string;
  passwordConfirmation: string;
  username: string;
};

export type SetupFieldErrors = Partial<Record<keyof SetupFormState, string>>;
