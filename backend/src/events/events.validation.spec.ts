import {
  parseCancelEventDto,
  parseCompleteEventDto,
  parseStartEventDto,
} from './events.validation';

describe('events lifecycle validation', () => {
  it('parses lifecycle payloads', () => {
    expect(parseStartEventDto({ version: 1 })).toEqual({ version: 1 });
    expect(parseCancelEventDto({ version: 2 })).toEqual({ version: 2 });
    expect(
      parseCompleteEventDto({
        factDate: '2026-08-01',
        version: 3,
      }),
    ).toEqual({
      factDate: new Date('2026-08-01T00:00:00.000Z'),
      version: 3,
    });
  });

  it.each([undefined, null, ''])(
    'treats empty fact date %p as not supplied',
    (factDate) => {
      expect(
        parseCompleteEventDto({
          factDate,
          version: 1,
        }),
      ).toEqual({
        factDate: undefined,
        version: 1,
      });
    },
  );

  it('rejects lifecycle payload without version', () => {
    expect(() => parseStartEventDto({})).toThrow('Укажите версию события.');
    expect(() => parseCompleteEventDto({})).toThrow('Укажите версию события.');
    expect(() => parseCancelEventDto({})).toThrow('Укажите версию события.');
  });

  it('rejects normalized invalid fact date', () => {
    expect(() =>
      parseCompleteEventDto({
        factDate: '2026-02-31',
        version: 1,
      }),
    ).toThrow('Некорректная фактическая дата.');
  });
});
