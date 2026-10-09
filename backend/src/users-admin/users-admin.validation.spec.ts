import { BadRequestException } from '@nestjs/common';
import {
  parseCreateUserPayload,
  parseUpdateUserPayload,
} from './users-admin.validation';

const userPayload = {
  email: 'user@example.com',
  username: 'test-user',
  role: 'ppe_specialist',
  password: 'password123',
};

describe.each([
  { name: 'create user', parse: parseCreateUserPayload },
  { name: 'update user', parse: parseUpdateUserPayload },
])('$name employee ID validation', ({ parse }) => {
  it.each([
    true,
    false,
    '1',
    [1],
    { valueOf: () => 1 },
    null,
    undefined,
    0,
    -1,
    1.5,
    NaN,
    Infinity,
  ])('rejects invalid employee ID %p', (employeeId) => {
    let caught: unknown;
    try {
      parse({ ...userPayload, employeeId });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(BadRequestException);
    expect(caught).toMatchObject({
      response: { code: 'EMPLOYEE_REQUIRED' },
    });
  });

  it('accepts a positive integer without conversion', () => {
    expect(parse({ ...userPayload, employeeId: 1 }).employeeId).toBe(1);
  });
});
