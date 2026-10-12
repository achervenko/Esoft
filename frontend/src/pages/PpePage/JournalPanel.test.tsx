import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ppeApi } from "../../shared/api/ppe";
import { JournalPanel } from "./JournalPanel";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("shows empty results after applying filters without Enter", async () => {
  vi.spyOn(ppeApi, "journal").mockResolvedValue({ items: [], total: 0, page: 1, limit: 100 });
  render(<JournalPanel employees={[]} positions={[]} items={[]} role="admin" revision={0} onChanged={vi.fn()} />);
  await screen.findByText("Выдач по выбранным фильтрам нет.");
  fireEvent.click(screen.getByRole("button", { name: "Фильтры" }));
  fireEvent.change(screen.getByLabelText("Статус"), { target: { value: "CANCELLED" } });
  fireEvent.click(screen.getByRole("button", { name: "Применить" }));
  await waitFor(() => expect(ppeApi.journal).toHaveBeenLastCalledWith(expect.objectContaining({ status: "CANCELLED" }), expect.any(AbortSignal)));
  await screen.findByText("Выдач по выбранным фильтрам нет.");
});
it("shows empty results after debounce without Enter and hides stale messages while typing", async () => {
  vi.spyOn(ppeApi, "journal").mockResolvedValue({ items: [], total: 0, page: 1, limit: 100 });
  render(
    <JournalPanel
      employees={[]}
      positions={[]}
      items={[]}
      role="admin"
      revision={0}
      onChanged={vi.fn()}
    />,
  );
  await waitFor(() => expect(ppeApi.journal).toHaveBeenCalled());
  const input = screen.getByLabelText("Поиск по журналу");
  await screen.findByText("Выдач по выбранным фильтрам нет.");
  fireEvent.change(input, { target: { value: "Ботинки" } });
  expect(
    screen.queryByText("Выдач по выбранным фильтрам нет."),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText("По вашему запросу ничего не найдено."),
  ).not.toBeInTheDocument();
  await screen.findByText("По вашему запросу ничего не найдено.");
  expect(ppeApi.journal).toHaveBeenLastCalledWith(expect.objectContaining({ search: "Ботинки" }), expect.any(AbortSignal));
  fireEvent.click(screen.getByRole("button", { name: "Очистить поиск" }));
  await screen.findByText("Выдач по выбранным фильтрам нет.");
});
