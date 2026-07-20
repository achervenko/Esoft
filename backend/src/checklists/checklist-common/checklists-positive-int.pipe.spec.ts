import { BadRequestException } from '@nestjs/common';
import { ParseChecklistPositiveIntPipe } from './checklists-positive-int.pipe';

describe('ParseChecklistPositiveIntPipe', () => {
  const pipe = new ParseChecklistPositiveIntPipe();

  it('parses positive safe integer strings', () => {
    expect(pipe.transform('42')).toBe(42);
  });

  it('rejects zero and negative values', () => {
    expectBadRequestCode(() => pipe.transform('0')).toBe('ROUTE_ID_INVALID');
    expectBadRequestCode(() => pipe.transform('-1')).toBe('ROUTE_ID_INVALID');
  });

  it('rejects unsafe integers', () => {
    expectBadRequestCode(() =>
      pipe.transform(String(Number.MAX_SAFE_INTEGER + 1)),
    ).toBe('ROUTE_ID_INVALID');
  });

  it('rejects fractional and non-numeric values', () => {
    expectBadRequestCode(() => pipe.transform('1.5')).toBe('ROUTE_ID_INVALID');
    expectBadRequestCode(() => pipe.transform('abc')).toBe('ROUTE_ID_INVALID');
  });
});

function expectBadRequestCode(action: () => unknown) {
  try {
    action();
  } catch (error) {
    if (error instanceof BadRequestException) {
      const response = error.getResponse();

      if (
        response &&
        typeof response === 'object' &&
        'code' in response &&
        typeof response.code === 'string'
      ) {
        return expect(response.code);
      }
    }

    throw error;
  }

  throw new Error('Expected BadRequestException to be thrown.');
}
