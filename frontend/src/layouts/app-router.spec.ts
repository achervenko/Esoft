import { describe, expect, it } from "vitest";
import { resolveAppRoute } from "./app-router";

describe("resolveAppRoute", () => {
  it("accepts preserved search routes on PPE detail links", () => {
    const query = "?returnTo=" + encodeURIComponent("#/search?q=сок&module=ppe");
    expect(resolveAppRoute("#/ppe/employees/1" + query)).toEqual({ kind: "ppe", tab: "issue", employeeId: 1 });
    expect(resolveAppRoute("#/ppe/positions/1" + query)).toEqual({ kind: "ppe", tab: "norms", positionId: 1 });
  });
  it("resolves the employee PPE card", () => {
    expect(resolveAppRoute("#/ppe/employees/1")).toEqual({
      kind: "ppe", tab: "issue", employeeId: 1,
    });
  });
  it("resolves position PPE norms", () => {
    expect(resolveAppRoute("#/ppe/positions/1")).toEqual({
      kind: "ppe", tab: "norms", positionId: 1,
    });
  });
  it.each([
    "#/ppe/employees/0", "#/ppe/employees/abc",
    "#/ppe/positions/0", "#/ppe/positions/abc",
  ])("rejects invalid PPE route %s", (route) => {
    expect(resolveAppRoute(route)).toEqual({ kind: "unknown" });
  });
  it.each(["journal", "norms", "catalog"] as const)(
    "resolves PPE tab %s",
    (tab) => {
      expect(resolveAppRoute(`#/ppe?tab=${tab}`)).toEqual({ kind: "ppe", tab });
    },
  );
  it("defaults unknown PPE tabs and rejects unrelated PPE paths", () => {
    expect(resolveAppRoute("#/ppe")).toEqual({ kind: "ppe", tab: "norms" });
    expect(resolveAppRoute("#/ppe?tab=unknown")).toEqual({
      kind: "ppe",
      tab: "norms",
    });
    expect(resolveAppRoute("#/ppe-other")).toEqual({ kind: "unknown" });
  });
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
