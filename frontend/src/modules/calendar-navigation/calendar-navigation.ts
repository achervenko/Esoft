import type { CalendarNavigationDto } from "../../shared/api/calendar";
import { setHashRoute } from "../../lib/hash-router";
import { resolveEquipmentEventCalendarNavigation } from "../equipment-events/calendar-navigation";

type CalendarNavigationResolver = (
  navigation: CalendarNavigationDto,
  returnTo: string,
) => string | null;

const calendarNavigationResolvers: CalendarNavigationResolver[] = [
  resolveEquipmentEventCalendarNavigation,
];

export function openCalendarNavigation(
  navigation: CalendarNavigationDto | null | undefined,
  params: { returnTo: string },
) {
  if (!navigation) {
    return false;
  }

  for (const resolveNavigation of calendarNavigationResolvers) {
    const route = resolveNavigation(navigation, params.returnTo);

    if (route) {
      setHashRoute(route);
      return true;
    }
  }

  return false;
}
