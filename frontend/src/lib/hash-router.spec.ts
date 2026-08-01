import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LOGIN_ROUTE,
  getHashRoute,
  isLoginRoute,
  isSetupRoute,
  normalizeHashRoute,
  setHashRoute,
  subscribeHashRouteNavigation,
} from "./hash-router";

afterEach(() => {
  window.location.hash = "";
  vi.restoreAllMocks();
});

describe("hash-router", () => {
  it("normalizes hash routes to a single canonical format", () => {
    expect(normalizeHashRoute("#/calendar")).toBe("#/calendar");
    expect(normalizeHashRoute("/calendar")).toBe("#/calendar");
    expect(normalizeHashRoute("calendar")).toBe("#/calendar");
    expect(normalizeHashRoute("")).toBe(LOGIN_ROUTE);
    expect(normalizeHashRoute("#")).toBe(LOGIN_ROUTE);
  });

  it("returns a normalized current hash route", () => {
    window.location.hash = "calendar";

    expect(getHashRoute()).toBe("#/calendar");
  });

  it("notifies subscribers with normalized routes", () => {
    window.location.hash = "#/dashboard";
    const listener = vi.fn();
    const unsubscribe = subscribeHashRouteNavigation(listener);

    setHashRoute("/calendar");

    expect(listener).toHaveBeenCalledWith("#/calendar");
    expect(window.location.hash).toBe("#/calendar");

    unsubscribe();
  });

  it("canonicalizes the browser hash even when the logical route is unchanged", () => {
    window.location.hash = "";

    setHashRoute(LOGIN_ROUTE);

    expect(getHashRoute()).toBe(LOGIN_ROUTE);
    expect(window.location.hash).toBe(LOGIN_ROUTE);
  });

  it("does not notify subscribers when the browser hash is already canonical", () => {
    window.location.hash = "#/calendar";
    const listener = vi.fn();
    const unsubscribe = subscribeHashRouteNavigation(listener);

    setHashRoute("#/calendar");

    expect(listener).not.toHaveBeenCalled();

    unsubscribe();
  });

  it("checks login and setup routes after normalization", () => {
    expect(isLoginRoute("#login")).toBe(true);
    expect(isLoginRoute("/login")).toBe(true);
    expect(isSetupRoute("#setup")).toBe(true);
    expect(isSetupRoute("setup")).toBe(true);
  });
});
