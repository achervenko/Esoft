import { BadRequestException } from '@nestjs/common';
import {
  parseCreateUserPayload,
  parseUpdateUserPayload,
  parseEmployeePayload,
} from './users-admin.validation';

it.each(['MALE', 'FEMALE'] as const)('accepts employee gender %s', (gender) => {
  expect(
    parseEmployeePayload({
      firstName: 'Иван',
      lastName: 'Иванов',
      positionId: 1,
      gender,
    }),
  ).toMatchObject({ gender });
});

describe('additional employee positions', () => {
  const employee = {
    gender: 'MALE',
    firstName: 'Иван',
    lastName: 'Иванов',
    positionId: 1,
  };
  it.each([[1], [2, 2], [0], [-1], ['2'], null].map((ids) => ({ ids })))(
    'rejects invalid IDs %p',
    ({ ids: additionalPositionIds }) => {
      expect(() =>
        parseEmployeePayload({ ...employee, additionalPositionIds }),
      ).toThrow();
    },
  );
  it('accepts several distinct additional positions', () => {
    expect(
      parseEmployeePayload({ ...employee, additionalPositionIds: [2, 3] }),
    ).toMatchObject({ additionalPositionIds: [2, 3] });
  });
});

it.each([undefined, null, '', 'ALL', 'male', 1])(
  'requires explicit employee gender: %p',
  (gender) => {
    let error: unknown;
    try {
      parseEmployeePayload({
        firstName: 'Иван',
        lastName: 'Иванов',
        positionId: 1,
        gender,
      });
    } catch (caught) {
      error = caught;
    }
    expect(error).toMatchObject({
      response: { code: 'EMPLOYEE_GENDER_REQUIRED' },
    });
  },
);

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
