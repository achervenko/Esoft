import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { searchApp, type SearchResultItem } from "../../shared/api/search-api";
import {
  employee,
  mobileViewport,
  mockViewport,
  openEmployeeCard,
  renderEmployees,
  searchEmployee,
} from "./dictionary-employees-test-helpers";

vi.mock("../../shared/api/search-api", () => ({ searchApp: vi.fn() }));

beforeEach(() => {
  vi.mocked(searchApp).mockReset().mockResolvedValue([]);
  mockViewport();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it("closes a mobile detail modal when its employee leaves the search results", () => {
  mobileViewport();
  renderEmployees();
  openEmployeeCard();
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  searchEmployee("я");
  expect(screen.queryByRole("dialog")).toBeNull();
  searchEmployee("");
  expect(
    screen.getByRole("button", { name: /Открыть карточку сотрудника/ }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).toBeNull();
});

it.each([false, true])(
  "searches employees by name and additional positions (mobile=%s)",
  async (mobile) => {
    if (mobile) mobileViewport();
    const item = {
      ...employee,
      additionalPositions: [{ id: 2, name: "Механик" }],
    };
    renderEmployees([item, { ...employee, id: 2, fullName: "Пётр Петров" }]);
    searchEmployee("  мЕХАНИК   иван ");
    expect(screen.getByText("Иван Иванов")).toBeInTheDocument();
    expect(screen.queryByText("Пётр Петров")).toBeNull();
    searchEmployee("неизвестный");
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Сотрудники не найдены",
      ),
    );
    searchEmployee("");
    expect(screen.getByText("Пётр Петров")).toBeInTheDocument();
  },
);

it("uses common search restricted to employees for typo matches", async () => {
  vi.mocked(searchApp).mockResolvedValue([
    { entityType: "employee", entityId: 1 } as SearchResultItem,
  ]);
  renderEmployees();
  searchEmployee("ивнов");
  await waitFor(() =>
    expect(screen.getByText("Иван Иванов")).toBeInTheDocument(),
  );
  expect(searchApp).toHaveBeenCalledWith(
    expect.objectContaining({
      query: "ивнов",
      entityType: "employee",
      limit: 100,
      signal: expect.any(AbortSignal),
    }),
  );
});

it("shows search failures with exact results and allows retry", async () => {
  vi.mocked(searchApp).mockRejectedValueOnce(new Error("Сервер недоступен"));
  renderEmployees();
  searchEmployee("инженер");
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent("Сервер недоступен"),
  );
  expect(screen.getByText("Иван Иванов")).toBeInTheDocument();
  expect(screen.queryByText("Сотрудники не найдены.")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Повторить поиск" }));
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  expect(searchApp).toHaveBeenCalledTimes(2);
});

it("aborts pending search and ignores its result after clearing", async () => {
  let finish!: (items: SearchResultItem[]) => void;
  vi.mocked(searchApp).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  renderEmployees([employee, { ...employee, id: 2, fullName: "Пётр Петров" }]);
  searchEmployee("ивнов");
  await waitFor(() => expect(searchApp).toHaveBeenCalledTimes(1));
  const signal = vi.mocked(searchApp).mock.calls[0][0].signal!;
  fireEvent.click(
    screen.getByRole("button", { name: "Очистить поиск сотрудников" }),
  );
  expect(signal.aborted).toBe(true);
  await act(async () =>
    finish([{ entityType: "employee", entityId: 1 } as SearchResultItem]),
  );
  expect(screen.getByText("Пётр Петров")).toBeInTheDocument();
});
