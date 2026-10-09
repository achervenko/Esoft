import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ppeApi } from "../../shared/api/ppe";
import { PpePage } from "./PpePage";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("renders and focuses journal search before reference and journal requests finish", () => {
  for (const name of ["items", "employees", "positions", "journal"] as const) {
    vi.spyOn(ppeApi, name).mockReturnValue(new Promise<never>(() => {}));
  }
  render(<PpePage userRole="admin" initialTab="journal" />);
  const search = screen.getByLabelText("Поиск по журналу");
  expect(search).toHaveFocus();
  const loading = screen.getByRole("status");
  expect(loading).toHaveTextContent("Загрузка...");
  expect(loading.closest(".admin-card")).toBeNull();
  expect(
    search.compareDocumentPosition(loading) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(screen.getAllByText("Загрузка...")).toHaveLength(1);
});
