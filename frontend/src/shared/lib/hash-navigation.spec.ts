import { describe, expect, it } from "vitest";
import {
  buildHashRoute,
  getHashRouteParam,
  getSafeReturnTo,
} from "./hash-navigation";

describe("hash-navigation", () => {
  it("keeps empty string params because they are valid strings", () => {
    expect(buildHashRoute("#/equipment", { tab: "" })).toBe(
      "#/equipment?tab=",
    );
  });

  it("skips only null and undefined params", () => {
    expect(
      buildHashRoute("#/equipment?tab=events", {
        empty: "",
        eventId: undefined,
        returnTo: null,
      }),
    ).toBe("#/equipment?tab=events&empty=");
  });

  it("encodes and restores returnTo with its own query params", () => {
    const route = buildHashRoute("#/equipment/12", {
      eventId: "34",
      returnTo: "#/calendar?date=2026-08-01",
      tab: "events",
    });

    expect(getHashRouteParam(route, "returnTo")).toBe(
      "#/calendar?date=2026-08-01",
    );
  });

  it("replaces an existing query param", () => {
    expect(
      buildHashRoute("#/equipment?tab=overview", {
        tab: "events",
      }),
    ).toBe("#/equipment?tab=events");
  });

  it("reads query params from hash routes", () => {
    expect(getHashRouteParam("#/equipment?tab=events", "tab")).toBe("events");
    expect(getHashRouteParam("#/equipment", "tab")).toBeNull();
  });

  it("allows internal hash return routes and rejects external values", () => {
    expect(getSafeReturnTo("#/calendar")).toBe("#/calendar");
    expect(getSafeReturnTo("#/")).toBe("#/");
    expect(getSafeReturnTo("")).toBe("#/equipment");
    expect(getSafeReturnTo("https://example.com")).toBe("#/equipment");
    expect(getSafeReturnTo(null)).toBe("#/equipment");
  });
});
