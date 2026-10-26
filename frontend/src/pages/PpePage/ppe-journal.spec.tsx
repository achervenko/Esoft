import { permissionsForTest } from "../../test/permission-fixtures";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ppeApi } from "../../shared/api/ppe";
import { render } from "./ppe-ui-test-utils";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
import { JournalPanel } from "./JournalPanel";
import { employee, item, issue } from "./ppe-test-fixtures";

describe("PPE journal", () => {
  it("searches historical names and articles together with applied filters", async () => {
    vi.spyOn(ppeApi, "journal").mockImplementation(async (query) => {
      const items = query.search === "несуществующий СИЗ" ? [] : [issue];
      return { items, total: items.length, page: 1, limit: 100 };
    });
    render(
      <JournalPanel
        employees={[employee]}
        positions={[]}
        items={[item]}
        permissions={permissionsForTest("admin")}
        revision={0}
        onChanged={vi.fn()}
      />,
    );
    await screen.findByText(issue.employeeName);
    const search = screen.getByRole("searchbox", { name: "Поиск по журналу" });
    fireEvent.change(search, {
      target: {
        value: `${issue.employeeName.split(" ")[0]} ${issue.article.toLowerCase()}`,
      },
    });
    await screen.findByText(issue.employeeName);
    fireEvent.change(search, { target: { value: "несуществующий СИЗ" } });
    expect(
      screen.queryByText("По вашему запросу ничего не найдено."),
    ).not.toBeInTheDocument();
    fireEvent.keyDown(search, { key: "Enter" });
    await screen.findByText("По вашему запросу ничего не найдено.");
    fireEvent.click(screen.getByRole("button", { name: "Очистить поиск" }));
    fireEvent.click(screen.getByRole("button", { name: "Фильтры" }));
    const nomenclature = screen.getByRole("combobox", { name: "Номенклатура" });
    fireEvent.change(nomenclature, { target: { value: item.article } });
    fireEvent.click(
      screen.getByRole("option", { name: `${item.article} — ${item.name}` }),
    );
    fireEvent.change(screen.getByLabelText("Статус"), {
      target: { value: "ISSUED" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Применить" }));
    await waitFor(() =>
      expect(ppeApi.journal).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: "ISSUED",
          ppeItemId: String(item.id),
        }),
        expect.any(AbortSignal),
      ),
    );
    await screen.findByText(issue.employeeName);
    expect(screen.queryByLabelText("Статус")).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: issue.article } });
    await screen.findByText(issue.employeeName);
  });
  it("combines backend filters and resets them, including inactive references", async () => {
    vi.spyOn(ppeApi, "journal").mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 100,
    });
    render(
      <JournalPanel
        employees={[{ ...employee, isActive: false }]}
        positions={[{ id: 2, name: "Инженер", isActive: false }]}
        items={[{ ...item, isActive: false }]}
        permissions={permissionsForTest("admin")}
        revision={0}
        onChanged={vi.fn()}
      />,
    );
    await screen.findByText("Выдач по выбранным фильтрам нет.");
    expect(screen.queryByLabelText("Сотрудник")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Фильтры" }));
    fireEvent.change(screen.getByLabelText("Сотрудник"), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByLabelText("Статус"), {
      target: { value: "CANCELLED" },
    });
    fireEvent.change(screen.getByLabelText("Дата с"), {
      target: { value: "2026-01-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Применить" }));
    await waitFor(() =>
      expect(ppeApi.journal).toHaveBeenLastCalledWith(
        expect.objectContaining({
          employeeId: "1",
          status: "CANCELLED",
          dateFrom: "2026-01-01",
        }),
        expect.any(AbortSignal),
      ),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Фильтры" }));
    expect(
      screen.getByRole("dialog", { name: "Фильтры журнала" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Сбросить" }));
    await waitFor(() =>
      expect(ppeApi.journal).toHaveBeenLastCalledWith(
        {
          page: "1",
          limit: "100",
          search: "",
          sort: "date",
          direction: "desc",
        },
        expect.any(AbortSignal),
      ),
    );
  });
});
