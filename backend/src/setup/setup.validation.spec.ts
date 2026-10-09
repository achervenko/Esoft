import { parseCreateInitialAdminDto } from './setup.validation';
const credentials = {
  email: 'admin@example.test',
  username: 'admin',
  password: 'Secure1234',
  passwordConfirmation: 'Secure1234',
};
it.each(['Admin123', 'admin123', 'ADMIN123'])(
  'rejects a password matching username regardless of case: %s',
  (password) => {
    let error: unknown;
    try {
      parseCreateInitialAdminDto({
        ...credentials,
        employeeId: 1,
        username: ' Admin123 ',
        password,
        passwordConfirmation: password,
      });
    } catch (caught) {
      error = caught;
    }
    expect(error).toMatchObject({
      response: { code: 'SETUP_PASSWORD_TOO_WEAK' },
    });
  },
);
it.each(['User1@example.com', 'user1@example.com', 'USER1@EXAMPLE.COM'])(
  'rejects a password matching email regardless of case: %s',
  (password) => {
    let error: unknown;
    try {
      parseCreateInitialAdminDto({
        ...credentials,
        employeeId: 1,
        email: 'User1@example.com',
        password,
        passwordConfirmation: password,
      });
    } catch (caught) {
      error = caught;
    }
    expect(error).toMatchObject({
      response: { code: 'SETUP_PASSWORD_TOO_WEAK' },
    });
  },
);
it('preserves the case of a valid different password', () => {
  expect(
    parseCreateInitialAdminDto({ ...credentials, employeeId: 1 }).password,
  ).toBe('Secure1234');
});
it('accepts an existing employee', () => {
  expect(
    parseCreateInitialAdminDto({ ...credentials, employeeId: 1 }).employeeId,
  ).toBe(1);
});
it('normalizes the initial administrator username to lowercase', () => {
  expect(
    parseCreateInitialAdminDto({
      ...credentials,
      employeeId: 1,
      username: ' Admin ',
    }).username,
  ).toBe('admin');
});
it('normalizes new employee names', () => {
  expect(
    parseCreateInitialAdminDto({
      ...credentials,
      employee: { lastName: ' Иванов ', firstName: ' Иван ', middleName: ' ' },
    }).employee,
  ).toEqual({ lastName: 'Иванов', firstName: 'Иван', middleName: null });
});
it.each([
  null,
  [],
  {},
  { lastName: 'Иванов', firstName: '' },
  { lastName: 'x'.repeat(65), firstName: 'Иван' },
  { lastName: 'Иванов', firstName: 'Иван', positionId: 2 },
])('rejects invalid new employee %p', (employee) => {
  expect(() =>
    parseCreateInitialAdminDto({ ...credentials, employee }),
  ).toThrow();
});
it('rejects simultaneous employee creation and selection', () => {
  expect(() =>
    parseCreateInitialAdminDto({
      ...credentials,
      employeeId: 1,
      employee: { lastName: 'Иванов', firstName: 'Иван' },
    }),
  ).toThrow();
});
