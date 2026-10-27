import { warehousesApi } from "../../shared/api/warehouses-api";
vi.mock("../../shared/api/warehouses-api", () => ({
  warehousesApi: { list: vi.fn() },
}));
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { ReactElement } from "react";
import {
  cleanup,
  fireEvent,
  render as rawRender,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { StorageLocationsPanel } from "./StorageLocationsPanel";
import { storageLocationsApi } from "../../shared/api/storage-locations-api";
import { ConfirmationContext } from "../../shared/ui/confirmation-context";
vi.mock("../../shared/api/storage-locations-api", () => ({
  storageLocationsApi: {
    get: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));
function render(ui: ReactElement) {
  return rawRender(ui, {
    wrapper: ({ children }) => (
      <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
    ),
  });
}
const item = {
  id: "9007199254740993",
  warehouseId: "1",
  warehouse: { id: "1", code: "MAIN", name: "Основной склад", isActive: true },
  code: "A-01",
  name: "Полка",
  isActive: true,
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(warehousesApi.list).mockResolvedValue({
    items: [item.warehouse],
    total: 1,
    page: 1,
    limit: 100,
  });
  vi.mocked(storageLocationsApi.get).mockResolvedValue({
    ...item,
    hasStock: true,
  });
  vi.mocked(storageLocationsApi.list).mockResolvedValue({
    items: [item],
    total: 1,
    page: 1,
    limit: 50,
  });
  vi.mocked(storageLocationsApi.update).mockResolvedValue(item);
  vi.mocked(storageLocationsApi.create).mockResolvedValue(item);
});
afterEach(cleanup);
it.each([50, 0])(
  "starts the accumulated list over after deactivation reduces total to %i",
  async (remainingTotal) => {
    let total = 51;
    const first = { ...item, id: "1", code: "A-00" };
    const pages: string[] = [];
    vi.mocked(storageLocationsApi.list).mockImplementation(async (query) => {
      const page = query.get("page")!;
      pages.push(page);
      return {
        items: total > 0 ? [page === "1" ? first : item] : [],
        total,
        page: Number(page),
        limit: 50,
      };
    });
    vi.mocked(storageLocationsApi.update).mockImplementationOnce(async () => {
      total = remainingTotal;
      return { ...item, isActive: false };
    });
    render(
      <ConfirmationContext.Provider value={vi.fn().mockResolvedValue(true)}>
        <StorageLocationsPanel canManage />
      </ConfirmationContext.Provider>,
    );
    await screen.findByText("A-00");
    fireEvent.click(
      screen.getByRole("button", { name: "Настройки поиска мест хранения" }),
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByLabelText("Неактивные"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Применить" }));
    await screen.findByText("A-00");
    fireEvent.click(screen.getByRole("button", { name: "Показать ещё" }));
    await screen.findByText("A-01");
    expect(screen.getByText("A-00")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("switch", { name: "Активность места A-01" }),
    );
    await waitFor(() => expect(pages.slice(-2)).toEqual(["2", "1"]));
    if (remainingTotal) await screen.findByText("A-00");
    else await screen.findByText("Места хранения не найдены.");
    expect(screen.queryByText("A-01")).toBeNull();
    expect(screen.queryByRole("button", { name: "Показать ещё" })).toBeNull();
  },
);
it("keeps the read-only list usable and sends filters", async () => {
  render(<StorageLocationsPanel canManage={false} />);
  await screen.findByText("A-01");
  expect(screen.queryByRole("button", { name: "Добавить место" })).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Редактировать место A-01" }),
  ).toBeNull();
  expect(screen.queryByRole("combobox")).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Настройки поиска мест хранения" }),
  );
  const filters = screen.getByRole("dialog", { name: "Настройки поиска" });
  fireEvent.click(within(filters).getByLabelText("Активные"));
  fireEvent.click(within(filters).getByRole("button", { name: "Применить" }));
  await waitFor(() =>
    expect(
      vi.mocked(storageLocationsApi.list).mock.lastCall?.[0].get("isActive"),
    ).toBe("false"),
  );
  fireEvent.change(screen.getByLabelText("Поиск мест хранения"), {
    target: { value: "пол" },
  });
  await waitFor(() =>
    expect(
      vi.mocked(storageLocationsApi.list).mock.lastCall?.[0].get("search"),
    ).toBe("пол"),
  );
});
it("edits only changed fields and preserves bigint ID", async () => {
  render(<StorageLocationsPanel canManage />);
  await screen.findByText("A-01");
  fireEvent.click(screen.getByText("A-01"));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Наименование"), {
    target: { value: "Новая полка" },
  });
  await waitFor(() =>
    expect(within(dialog).getByText("Сохранить")).not.toBeDisabled(),
  );
  await waitFor(() =>
    expect(within(dialog).getByText("Сохранить")).not.toBeDisabled(),
  );
  fireEvent.click(within(dialog).getByText("Сохранить"));
  await waitFor(() =>
    expect(storageLocationsApi.update).toHaveBeenCalledWith(item.id, {
      name: "Новая полка",
    }),
  );
});
it("keeps the form open when create fails", async () => {
  vi.mocked(storageLocationsApi.create).mockRejectedValue(
    new Error("Код уже существует"),
  );
  render(<StorageLocationsPanel canManage />);
  await screen.findByText("A-01");
  fireEvent.click(screen.getByRole("button", { name: "Добавить место" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Код"), {
    target: { value: "A-01" },
  });
  fireEvent.change(within(dialog).getByLabelText("Наименование"), {
    target: { value: "Другая" },
  });
  await waitFor(() =>
    expect(within(dialog).getByText("Сохранить")).not.toBeDisabled(),
  );
  fireEvent.click(within(dialog).getByText("Сохранить"));
  await within(dialog).findByText("Код уже существует");
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(screen.getAllByText("Код уже существует")).toHaveLength(1);
  expect(
    screen.queryByRole("button", { name: "Повторить загрузку" }),
  ).toBeNull();
  fireEvent.click(within(dialog).getByRole("button", { name: "Отмена" }));
  fireEvent.click(screen.getByRole("button", { name: "Добавить место" }));
  expect(screen.queryByText("Код уже существует")).toBeNull();
});
it("retries list errors without showing them in the form", async () => {
  vi.mocked(storageLocationsApi.list).mockRejectedValueOnce(
    new Error("Список недоступен"),
  );
  render(<StorageLocationsPanel canManage />);
  await screen.findByText("Список недоступен");
  fireEvent.click(screen.getByRole("button", { name: "Добавить место" }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).queryByText("Список недоступен")).toBeNull();
  fireEvent.click(within(dialog).getByRole("button", { name: "Отмена" }));
  fireEvent.click(screen.getByRole("button", { name: "Повторить загрузку" }));
  await screen.findByText("A-01");
  expect(screen.queryByText("Список недоступен")).toBeNull();
});

it("shows status operation errors without a list retry button", async () => {
  vi.mocked(storageLocationsApi.get).mockRejectedValueOnce(
    new Error("Не удалось проверить остаток"),
  );
  render(<StorageLocationsPanel canManage />);
  await screen.findByText("A-01");
  fireEvent.click(
    screen.getByRole("switch", { name: "Активность места A-01" }),
  );
  await screen.findByText("Не удалось проверить остаток");
  expect(
    screen.queryByRole("button", { name: "Повторить загрузку" }),
  ).toBeNull();
  expect(storageLocationsApi.update).not.toHaveBeenCalled();
});
it("does not deactivate when the user cancels the warning", async () => {
  const confirm = vi.fn().mockResolvedValue(false);
  render(
    <ConfirmationContext.Provider value={confirm}>
      <StorageLocationsPanel canManage />
    </ConfirmationContext.Provider>,
  );
  await screen.findByText("A-01");
  fireEvent.click(
    screen.getByRole("switch", { name: "Активность места A-01" }),
  );
  await waitFor(() => expect(confirm).toHaveBeenCalledOnce());
  expect(storageLocationsApi.update).not.toHaveBeenCalled();
});

it("shows warehouse, code, name and status columns", async () => {
  render(<StorageLocationsPanel canManage />);
  await screen.findByText("A-01");
  expect(screen.getAllByRole("columnheader")).toHaveLength(4);
  expect(
    screen.getByRole("searchbox", { name: "Поиск мест хранения" }),
  ).toBeTruthy();
});
it("applies filter drafts only on submit and supports reset", async () => {
  render(<StorageLocationsPanel canManage={false} />);
  await screen.findByText("A-01");
  fireEvent.click(
    screen.getByRole("button", { name: "Настройки поиска мест хранения" }),
  );
  let dialog = screen.getByRole("dialog");
  fireEvent.click(within(dialog).getByLabelText("Неактивные"));
  expect(
    vi.mocked(storageLocationsApi.list).mock.lastCall?.[0].has("isActive"),
  ).toBe(false);
  fireEvent.click(within(dialog).getByRole("button", { name: "Применить" }));
  await waitFor(() =>
    expect(
      vi.mocked(storageLocationsApi.list).mock.lastCall?.[0].get("isActive"),
    ).toBe("true"),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Настройки поиска мест хранения" }),
  );
  dialog = screen.getByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: "Сбросить" }));
  expect(
    vi.mocked(storageLocationsApi.list).mock.lastCall?.[0].get("isActive"),
  ).toBe("true");
  fireEvent.click(within(dialog).getByRole("button", { name: "Применить" }));
  await waitFor(() =>
    expect(
      vi.mocked(storageLocationsApi.list).mock.lastCall?.[0].has("isActive"),
    ).toBe(false),
  );
});

it("creates a location with its selected warehouse", async () => {
  render(<StorageLocationsPanel canManage />);
  await screen.findByText("A-01");
  fireEvent.click(screen.getByRole("button", { name: "Добавить место" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Код"), {
    target: { value: "CORNER" },
  });
  fireEvent.change(within(dialog).getByLabelText("Наименование"), {
    target: { value: "Угол ангара" },
  });
  await waitFor(() =>
    expect(within(dialog).getByText("Сохранить")).not.toBeDisabled(),
  );
  fireEvent.click(within(dialog).getByText("Сохранить"));
  await waitFor(() =>
    expect(storageLocationsApi.create).toHaveBeenCalledWith({
      warehouseId: "1",
      code: "CORNER",
      name: "Угол ангара",
      isActive: true,
    }),
  );
});

it("blocks location creation when no warehouse is available", async () => {
  vi.mocked(warehousesApi.list).mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    limit: 100,
  });
  render(<StorageLocationsPanel canManage />);
  await screen.findByText("A-01");
  fireEvent.click(screen.getByRole("button", { name: "Добавить место" }));
  await screen.findByText("Нет активных складов. Сначала создайте склад.");
  expect(
    within(screen.getByRole("dialog")).getByText("Сохранить"),
  ).toBeDisabled();
  expect(storageLocationsApi.create).not.toHaveBeenCalled();
});
