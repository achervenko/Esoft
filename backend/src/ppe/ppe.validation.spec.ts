import {
  parseEmployeeSizes,
  parsePpeItem,
  parsePpeSize,
  parsePpeStatus,
  parsePpeSizeSet,
} from './ppe.validation';

describe('PPE payload validation', () => {
  it.each(['-', '‐', '‑', '‒', '–', '—', '―', '−', '﹘', '﹣', '－'])(
    'normalizes size and employee ranges containing %s',
    (dash) => {
      expect(
        parsePpeSize({ value: ` 88 ${dash} 92 ; 170 ${dash} 176 ` }),
      ).toEqual({ value: '88–92', heightValue: '170–176' });
      expect(
        parseEmployeeSizes({
          clothingSize: `88${dash}92`,
          clothingHeight: `170 ${dash} 176`,
        }),
      ).toEqual({ clothingSize: '88–92', clothingHeight: '170–176' });
    },
  );
  it('rejects duplicate pairs after punctuation normalization', () => {
    expect(() =>
      parsePpeSizeSet({
        sizes: [{ value: '88-92;170-176' }, { value: '88—92;170 − 176' }],
      }),
    ).toThrow();
  });
  it('splits each serialized clothing pair into its own size and height', () => {
    expect(parsePpeSize({ value: '88–92;170–176' })).toEqual({
      value: '88–92',
      heightValue: '170–176',
    });
    for (const value of ['88-92;', ';170-176', '88-92;170-176;182-188'])
      expect(() => parsePpeSize({ value })).toThrow();
    expect(() =>
      parsePpeSize({ value: '88–92;170–176', heightValue: '182–188' }),
    ).toThrow();
  });
  it.each([undefined, null, '', 'UNKNOWN', true, 1])(
    'requires a valid PPE type: %p',
    (type) => {
      expect(() =>
        parsePpeItem({ article: 'A', name: 'N', unit: 'пары', type }),
      ).toThrow();
    },
  );
  it('rejects omitted type and the obsolete sizeKind field', () => {
    expect(() =>
      parsePpeItem({ article: 'A', name: 'N', unit: 'пары' }),
    ).toThrow();
    expect(() =>
      parsePpeItem({
        article: 'A',
        name: 'N',
        unit: 'пары',
        type: 'OTHER',
        sizeKind: 'NONE',
      }),
    ).toThrow();
  });
  it.each([
    'positionId',
    'isActive',
    'firstName',
    'lastName',
    'middleName',
    'role',
    'userId',
    'issuedByUserId',
  ])('rejects foreign employee field %s', (field) => {
    expect(() =>
      parseEmployeeSizes({ clothingSize: '52', [field]: 'malicious' }),
    ).toThrow();
  });

  it('clears explicitly supplied sizes and leaves omitted fields untouched', () => {
    expect(
      parseEmployeeSizes({
        clothingSize: '   ',
        gloveSize: null,
        clothingHeight: ' 170-176 ',
        shoeSize: 42.5,
      }),
    ).toEqual({
      clothingSize: null,
      gloveSize: null,
      clothingHeight: '170–176',
      shoeSize: 42.5,
    });
  });

  it.each([
    {},
    null,
    [],
    '52',
    { clothingSize: 'x'.repeat(21) },
    { headwearSize: 58 },
    { shoeSize: '42' },
    { shoeSize: 42.55 },
    { shoeSize: NaN },
    { shoeSize: Infinity },
    { shoeSize: 14 },
    { shoeSize: 61 },
  ])('rejects invalid size patch %p', (payload) => {
    expect(() => parseEmployeeSizes(payload)).toThrow();
  });

  it('preserves valid boundary shoe sizes', () => {
    expect(parseEmployeeSizes({ shoeSize: 15 })).toEqual({ shoeSize: 15 });
    expect(parseEmployeeSizes({ shoeSize: 60 })).toEqual({ shoeSize: 60 });
  });

  it('trims catalog fields and preserves size text', () => {
    expect(
      parsePpeItem({
        article: ' A ',
        name: ' Boots ',
        unit: ' пары ',
        type: 'OTHER',
      }),
    ).toEqual({ article: 'A', name: 'Boots', unit: 'пары', type: 'OTHER' });
    expect(parsePpeSize({ value: ' 52-54 / 170-176 ' })).toEqual({
      value: '52–54 / 170–176',
      heightValue: null,
    });
  });

  it('trims the size-height pair and accepts explicit null height', () => {
    expect(
      parsePpeSize({ value: ' 52-54 ', heightValue: ' 170-176 ' }),
    ).toEqual({ value: '52–54', heightValue: '170–176' });
    expect(parsePpeSize({ value: '52–54', heightValue: null })).toEqual({
      value: '52–54',
      heightValue: null,
    });
    expect(
      parsePpeSize({ value: '52–54', heightValue: ' ' + 'x'.repeat(20) + ' ' }),
    ).toEqual({ value: '52–54', heightValue: 'x'.repeat(20) });
  });
  it.each([176, true, {}, [], '', '   ', 'x'.repeat(21)])(
    'rejects invalid heightValue %p',
    (heightValue) => {
      expect(() => parsePpeSize({ value: '52–54', heightValue })).toThrow();
    },
  );
  it('limits catalog size to 20 characters after trim', () => {
    expect(parsePpeSize({ value: ' ' + 'x'.repeat(20) + ' ' })).toEqual({
      value: 'x'.repeat(20),
      heightValue: null,
    });
    expect(() => parsePpeSize({ value: 'x'.repeat(21) })).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({ code: 'VALUE_TOO_LONG' }),
      }),
    );
  });
  it('rejects status injection and malformed catalog payloads', () => {
    expect(() =>
      parsePpeItem({
        article: 'A',
        name: 'Boots',
        unit: 'пары',
        type: 'OTHER',
        isActive: false,
      }),
    ).toThrow();
    expect(() => parsePpeSize({ value: '' })).toThrow();
    expect(() => parsePpeStatus({ isActive: false, ppeItemId: 2 })).toThrow();
    expect(() => parsePpeStatus({ isActive: 'false' })).toThrow();
  });
});
