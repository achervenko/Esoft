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
it("shows empty results only after Enter and hides them when the query changes", async () => {
  vi.spyOn(ppeApi, "journal").mockResolvedValue([]);
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
  expect(
    screen.queryByText("Выдач по выбранным фильтрам нет."),
  ).not.toBeInTheDocument();
  fireEvent.keyDown(input, { key: "Enter" });
  await screen.findByText("Выдач по выбранным фильтрам нет.");
  fireEvent.change(input, { target: { value: "Ботинки" } });
  expect(
    screen.queryByText("Выдач по выбранным фильтрам нет."),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText("По вашему запросу ничего не найдено."),
  ).not.toBeInTheDocument();
  fireEvent.keyDown(input, { key: "Enter" });
  expect(
    screen.getByText("По вашему запросу ничего не найдено."),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Очистить поиск" }));
  expect(
    screen.queryByText("Выдач по выбранным фильтрам нет."),
  ).not.toBeInTheDocument();
});
