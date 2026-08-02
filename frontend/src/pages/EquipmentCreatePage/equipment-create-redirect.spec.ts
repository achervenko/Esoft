import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearEquipmentCreateRedirectTimeout,
  scheduleEquipmentCreateRedirect,
} from "./equipment-create-redirect";

function createRedirectTimeoutRef() {
  return {
    current: null as number | null,
  };
}

describe("equipment create redirect timeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.location.hash = "#/equipment/create";
  });

  afterEach(() => {
    vi.useRealTimers();
    window.location.hash = "";
  });

  it("redirects to equipment registry after successful create delay", () => {
    const redirectTimeoutRef = createRedirectTimeoutRef();

    scheduleEquipmentCreateRedirect(redirectTimeoutRef);

    expect(window.location.hash).toBe("#/equipment/create");

    vi.advanceTimersByTime(499);
    expect(window.location.hash).toBe("#/equipment/create");

    vi.advanceTimersByTime(1);
    expect(window.location.hash).toBe("#/equipment");
    expect(redirectTimeoutRef.current).toBeNull();
  });

  it("clears pending redirect timeout on unmount cleanup", () => {
    const redirectTimeoutRef = createRedirectTimeoutRef();

    scheduleEquipmentCreateRedirect(redirectTimeoutRef);
    clearEquipmentCreateRedirectTimeout(redirectTimeoutRef);
    vi.advanceTimersByTime(500);

    expect(window.location.hash).toBe("#/equipment/create");
    expect(redirectTimeoutRef.current).toBeNull();
  });

  it("clears previous pending redirect before scheduling a new one", () => {
    const redirectTimeoutRef = createRedirectTimeoutRef();

    scheduleEquipmentCreateRedirect(redirectTimeoutRef);
    const firstTimeoutId = redirectTimeoutRef.current;

    vi.advanceTimersByTime(250);
    scheduleEquipmentCreateRedirect(redirectTimeoutRef);

    expect(redirectTimeoutRef.current).not.toBe(firstTimeoutId);

    vi.advanceTimersByTime(250);
    expect(window.location.hash).toBe("#/equipment/create");

    vi.advanceTimersByTime(250);
    expect(window.location.hash).toBe("#/equipment");
  });
});
