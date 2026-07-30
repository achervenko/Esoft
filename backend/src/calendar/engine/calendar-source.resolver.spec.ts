import { CalendarSourceResolver } from './calendar-source.resolver';

describe('CalendarSourceResolver', () => {
  function createResolver() {
    const equipmentEventsProvider = {};
    const productionCalendarProvider = {};
    const resolver = new CalendarSourceResolver(
      equipmentEventsProvider as never,
      productionCalendarProvider as never,
    );

    return { equipmentEventsProvider, productionCalendarProvider, resolver };
  }

  it('selects production calendar and equipment events for event viewers', () => {
    const { equipmentEventsProvider, productionCalendarProvider, resolver } =
      createResolver();

    expect(
      resolver.resolveProviders({
        user: {
          role: 'engineer',
        },
      } as never),
    ).toEqual([productionCalendarProvider, equipmentEventsProvider]);
  });

  it('selects providers for admin', () => {
    const { equipmentEventsProvider, productionCalendarProvider, resolver } =
      createResolver();

    expect(
      resolver.resolveProviders({
        user: {
          role: 'admin',
        },
      } as never),
    ).toEqual([productionCalendarProvider, equipmentEventsProvider]);
  });

  it('rejects user without available calendar sources', () => {
    const { resolver } = createResolver();

    expect(() =>
      resolver.resolveProviders({
        user: {
          role: 'operator',
        },
      } as never),
    ).toThrow('Недостаточно прав для просмотра календаря.');
  });
});
