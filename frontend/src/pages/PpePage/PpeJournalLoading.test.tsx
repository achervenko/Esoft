import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ppeApi } from "../../shared/api/ppe";
import { render } from "./ppe-ui-test-utils";
import { PpePage } from "./PpePage";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("renders and focuses journal search before reference and journal requests finish", async () => {
  for (const name of ["items", "employees", "positions", "journal"] as const) {
    vi.spyOn(ppeApi, name).mockReturnValue(new Promise<never>(() => {}));
  }
  render(<PpePage userRole="admin" initialTab="journal" />);
  const search = screen.getByLabelText("Поиск по журналу");
  expect(search).toHaveFocus();
  const loading = await screen.findByRole("status");
  expect(loading).toHaveTextContent("Загрузка...");
  expect(loading.closest(".admin-card")).toBeNull();
  expect(
    search.compareDocumentPosition(loading) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(screen.getAllByText("Загрузка...")).toHaveLength(1);
});

it.each([
  ["catalog", "Поиск по номенклатуре"],
  ["norms", "Поиск по должностям"],
] as const)(
  "keeps %s search visible before its data arrives",
  async (initialTab, label) => {
    for (const name of ["items", "employees", "positions", "norms"] as const) {
      vi.spyOn(ppeApi, name).mockReturnValue(new Promise<never>(() => {}));
    }
    render(<PpePage userRole="admin" initialTab={initialTab} />);
    const search = screen.getByLabelText(label);
    expect(search).toHaveFocus();
    const loading = await screen.findByRole("status");
    expect(
      search.compareDocumentPosition(loading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByText("Сотрудник не найден.")).toBeNull();
  },
);

it("focuses the new search without moving focus to the tab on mouse down", () => {
  for (const name of ["items", "employees", "positions", "norms", "journal"] as const) {
    vi.spyOn(ppeApi, name).mockReturnValue(new Promise<never>(() => {}));
  }
  const { rerender } = render(<PpePage userRole="admin" initialTab="catalog" />);
  const oldSearch = screen.getByLabelText("Поиск по номенклатуре");
  const tab = screen.getByRole("link", { name: "Журнал" });
  expect(fireEvent.mouseDown(tab, { button: 0 })).toBe(false);
  expect(oldSearch).toHaveFocus();
  fireEvent.click(tab);
  rerender(<PpePage userRole="admin" initialTab="journal" />);
  expect(screen.getByLabelText("Поиск по журналу")).toHaveFocus();
});
