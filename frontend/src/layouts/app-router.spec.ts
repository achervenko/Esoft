import { describe, expect, it } from "vitest";
import { resolveAppRoute } from "./app-router";

describe("resolveAppRoute", () => {
  it("resolves calendar route without query params", () => {
    expect(resolveAppRoute("#/calendar")).toEqual({
      date: null,
      kind: "calendar",
    });
  });

  it("resolves calendar route with query params", () => {
    expect(resolveAppRoute("#/calendar?date=2026-08-01")).toEqual({
      date: "2026-08-01",
      kind: "calendar",
    });
  });

  it("resolves equipment view route opened from calendar", () => {
    expect(
      resolveAppRoute(
        "#/equipment/42?eventId=7&returnTo=%23%2Fcalendar&tab=events",
      ),
    ).toEqual({
      eventId: 7,
      initialTab: "events",
      kind: "equipment-view",
      returnTo: "#/calendar",
      visibleId: 42,
    });
  });

  it("preserves calendar returnTo query params", () => {
    expect(
      resolveAppRoute(
        "#/equipment/42?eventId=7&returnTo=%23%2Fcalendar%3Fdate%3D2026-08-01&tab=events",
      ),
    ).toEqual({
      eventId: 7,
      initialTab: "events",
      kind: "equipment-view",
      returnTo: "#/calendar?date=2026-08-01",
      visibleId: 42,
    });
  });

  it("rejects invalid equipment event id", () => {
    expect(
      resolveAppRoute(
        "#/equipment/42?eventId=0&returnTo=%23%2Fcalendar&tab=events",
      ),
    ).toMatchObject({
      eventId: null,
      kind: "equipment-view",
      visibleId: 42,
    });
  });
});
