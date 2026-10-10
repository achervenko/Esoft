import { act, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import type { SearchResultItem } from "../../shared/api/search-api";

export function setupSearchPageTests() {
  beforeEach(() => {
    window.history.replaceState({ marker: "keep" }, "", "#/search?q=насос");
    sessionStorage.removeItem("search-viewed-results");
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    sessionStorage.removeItem("search-viewed-results");
  });
}

export function result(title: string): SearchResultItem {
  return {
    id: title, title, entityId: 1, entityType: "equipment", score: 1,
    subtitle: null, targetUrl: "#/equipment/1",
    details: { location: null, manufacturer: null, model: null, responsible: null, serialNumber: null, status: null },
  };
}
export function navigate(hash: string) {
  act(() => {
    window.history.replaceState(window.history.state, "", hash);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
}

