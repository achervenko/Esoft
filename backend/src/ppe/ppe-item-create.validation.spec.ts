import { parsePpeItemCreate } from './ppe.validation';

const item = { article: 'A', name: 'Костюм', unit: 'шт', type: 'BODY' };

it('requires a size/height pair for T-shirts', () => {
  expect(
    parsePpeItemCreate({
      ...item,
      type: 'TSHIRT',
      sizes: [{ value: '48;176' }],
    }),
  ).toMatchObject({
    data: { type: 'TSHIRT' },
    sizes: [{ value: '48', heightValue: '176' }],
  });
  expect(() =>
    parsePpeItemCreate({ ...item, type: 'TSHIRT', sizes: [{ value: '48' }] }),
  ).toThrow();
});

describe('PPE item creation with sizes', () => {
  it('accepts exactly 2000 distinct sizes', () => {
    const sizes = Array.from({ length: 2000 }, (_, index) => ({
      value: String(index),
      heightValue: '170–176',
    }));
    expect(parsePpeItemCreate({ ...item, sizes }).sizes).toHaveLength(2000);
  });

  it('rejects more than 2000 sizes before parsing their rows', () => {
    let caught: unknown;
    try {
      parsePpeItemCreate({ ...item, sizes: Array(2001).fill(null) });
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({
      response: {
        code: 'INVALID_PAYLOAD',
        message: 'Передайте список не более 2000 размеров.',
      },
    });
  });

  it.each(['шт', 'пары', 'мл'])('accepts the catalog unit %s', (unit) => {
    expect(parsePpeItemCreate({ ...item, unit }).data.unit).toBe(unit);
  });
  it.each(['шт.', 'пар', 'pair', 'кг', ''])(
    'rejects unsupported unit %s',
    (unit) => {
      expect(() => parsePpeItemCreate({ ...item, unit })).toThrow();
    },
  );
  it('accepts distinct clothing pairs and normalizes them', () => {
    expect(
      parsePpeItemCreate({
        ...item,
        sizes: [
          { value: ' 88-92 ', heightValue: ' 158-164 ' },
          { value: '88–92', heightValue: '170–176' },
        ],
      }).sizes,
    ).toEqual([
      { value: '88–92', heightValue: '158–164' },
      { value: '88–92', heightValue: '170–176' },
    ]);
  });

  it.each([
    { sizes: [{ value: '88–92' }] },
    {
      sizes: [
        { value: '88–92', heightValue: '170–176' },
        { value: ' 88-92 ', heightValue: '170–176' },
      ],
    },
    { type: 'OTHER', sizes: [{ value: '42' }] },
    { type: 'FEET', sizes: [{ value: '42', heightValue: '170–176' }] },
    { sizes: '42' },
  ])('rejects invalid size rows before mutation: %j', (values) => {
    expect(() => parsePpeItemCreate({ ...item, ...values })).toThrow();
  });
});
