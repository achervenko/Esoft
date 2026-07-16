import {
  normalizeDecimal,
  parseDecimalAnswer,
} from './checklist-work-answer.parser';

describe('checklist work answer parser', () => {
  describe('parseDecimalAnswer', () => {
    it('normalizes negative zero to zero', () => {
      expect(parseDecimalAnswer('-0')).toBe('0');
      expect(parseDecimalAnswer('-0.000000')).toBe('0');
    });

    it('checks integer precision after removing leading zeroes', () => {
      expect(parseDecimalAnswer('0000000000001')).toBe('1');
      expect(parseDecimalAnswer('-0000000000001.230000')).toBe('-1.23');
    });

    it('rejects values that exceed NUMERIC(18, 6) after normalization', () => {
      expect(() => parseDecimalAnswer('1000000000000')).toThrow(
        'Decimal-значение не помещается в NUMERIC(18, 6).',
      );
    });
  });

  describe('normalizeDecimal', () => {
    it('removes redundant zeroes and sign from zero', () => {
      expect(normalizeDecimal('001.230000')).toBe('1.23');
      expect(normalizeDecimal('-000.000000')).toBe('0');
    });
  });
});
