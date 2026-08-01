import type { CalendarNavigationDto } from "../../shared/api/calendar";
import { buildHashRoute } from "../../shared/lib/hash-navigation";

const EQUIPMENT_EVENT_NAVIGATION_TYPE = "equipment-event";

export function resolveEquipmentEventCalendarNavigation(
  navigation: CalendarNavigationDto,
  returnTo: string,
) {
  if (navigation.type !== EQUIPMENT_EVENT_NAVIGATION_TYPE) {
    return null;
  }

  const equipmentVisibleId = getPositiveNavigationNumber(
    navigation.params?.equipmentVisibleId,
  );
  const eventId = getPositiveNavigationNumber(navigation.params?.eventId);

  if (equipmentVisibleId === null || eventId === null) {
    return null;
  }

  return buildHashRoute(`#/equipment/${equipmentVisibleId}`, {
    eventId: String(eventId),
    returnTo,
    tab: "events",
  });
}

function getPositiveNavigationNumber(value: unknown) {
  if (
    typeof value !== "number" &&
    !(typeof value === "string" && value.trim() !== "")
  ) {
    return null;
  }

  const parsedValue = Number(value);

  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
}
