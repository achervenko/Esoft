import { BadRequestException } from '@nestjs/common';
import { ParseOptionalPositiveIntPipe } from './parse-optional-positive-int.pipe';
describe('ParseOptionalPositiveIntPipe', () => {
  const pipe = new ParseOptionalPositiveIntPipe();
  it('accepts an absent parameter', () => {
    expect(pipe.transform(undefined)).toBeUndefined();
  });
  it('parses a present positive safe integer', () => {
    expect(pipe.transform('42')).toBe(42);
  });
  it.each(['', ' ', '0', '-1', '9007199254740992', '1.5', 'abc', null])(
    'rejects present invalid value %p',
    (value) => {
      expect(() => pipe.transform(value)).toThrow(BadRequestException);
    },
  );
});
