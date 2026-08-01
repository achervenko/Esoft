import { describe, expect, it } from "vitest";
import type { CalendarNavigationDto } from "../../shared/api/calendar";
import { resolveEquipmentEventCalendarNavigation } from "./calendar-navigation";

describe("resolveEquipmentEventCalendarNavigation", () => {
  it("builds an equipment event route from positive numeric params", () => {
    const navigation: CalendarNavigationDto = {
      params: {
        equipmentVisibleId: 42,
        eventId: "7",
      },
      type: "equipment-event",
    };

    expect(resolveEquipmentEventCalendarNavigation(navigation, "#/calendar"))
      .toBe("#/equipment/42?eventId=7&returnTo=%23%2Fcalendar&tab=events");
  });

  it("rejects non-equipment event navigation", () => {
    const navigation: CalendarNavigationDto = {
      params: {
        equipmentVisibleId: 42,
        eventId: 7,
      },
      type: "other",
    };

    expect(resolveEquipmentEventCalendarNavigation(navigation, "#/calendar"))
      .toBeNull();
  });

  it("rejects empty strings and unsupported param types", () => {
    const invalidNavigationCases: CalendarNavigationDto[] = [
      {
        params: {
          equipmentVisibleId: "",
          eventId: 7,
        },
        type: "equipment-event",
      },
      {
        params: {
          equipmentVisibleId: true,
          eventId: 7,
        },
        type: "equipment-event",
      },
      {
        params: {
          equipmentVisibleId: 42,
          eventId: null,
        },
        type: "equipment-event",
      },
    ];

    for (const navigation of invalidNavigationCases) {
      expect(resolveEquipmentEventCalendarNavigation(navigation, "#/calendar"))
        .toBeNull();
    }
  });

  it("rejects zero, negative and fractional ids", () => {
    const invalidNavigationCases: CalendarNavigationDto[] = [
      {
        params: {
          equipmentVisibleId: 0,
          eventId: 7,
        },
        type: "equipment-event",
      },
      {
        params: {
          equipmentVisibleId: -1,
          eventId: 7,
        },
        type: "equipment-event",
      },
      {
        params: {
          equipmentVisibleId: 42,
          eventId: 1.5,
        },
        type: "equipment-event",
      },
    ];

    for (const navigation of invalidNavigationCases) {
      expect(resolveEquipmentEventCalendarNavigation(navigation, "#/calendar"))
        .toBeNull();
    }
  });

  it("preserves returnTo query params", () => {
    const navigation: CalendarNavigationDto = {
      params: {
        equipmentVisibleId: 42,
        eventId: 7,
      },
      type: "equipment-event",
    };

    expect(
      resolveEquipmentEventCalendarNavigation(
        navigation,
        "#/calendar?date=2026-08-01",
      ),
    ).toBe(
      "#/equipment/42?eventId=7&returnTo=%23%2Fcalendar%3Fdate%3D2026-08-01&tab=events",
    );
  });
});
