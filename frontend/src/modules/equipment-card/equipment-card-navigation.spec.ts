import { afterEach, describe, expect, it, vi } from "vitest";
import { navigateWithViewTransition } from "./equipment-card-navigation";

afterEach(() => {
  Reflect.deleteProperty(document, "startViewTransition");
  window.location.hash = "";
  vi.restoreAllMocks();
});

describe("navigateWithViewTransition", () => {
  it("updates hash directly when view transitions are unavailable", () => {
    window.location.hash = "#/equipment/42";

    navigateWithViewTransition("#/equipment/42/edit");

    expect(window.location.hash).toBe("#/equipment/42/edit");
  });

  it("does nothing when target hash is already active", () => {
    window.location.hash = "#/equipment/42/edit";
    const transitionSpy = vi.fn();

    document.startViewTransition = transitionSpy;

    navigateWithViewTransition("#/equipment/42/edit");

    expect(transitionSpy).not.toHaveBeenCalled();
  });

  it("uses startViewTransition when it is available", () => {
    window.location.hash = "#/equipment/42";
    const transitionSpy = vi.fn((callback: () => void) => callback());

    document.startViewTransition = transitionSpy;

    navigateWithViewTransition("#/equipment/42/history");

    expect(transitionSpy).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe("#/equipment/42/history");
  });

  it("falls back to direct hash update when transition throws", () => {
    window.location.hash = "#/equipment/42";
    document.startViewTransition = vi.fn(() => {
      throw new Error("boom");
    });

    navigateWithViewTransition("#/equipment/42/documents");

    expect(window.location.hash).toBe("#/equipment/42/documents");
  });
});
