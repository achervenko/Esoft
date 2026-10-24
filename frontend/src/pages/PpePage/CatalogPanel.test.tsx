import { permissionsForTest } from "../../test/permission-fixtures";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CatalogPanel } from "./CatalogPanel";
import { item } from "./ppe-test-fixtures";

afterEach(cleanup);
it("combines size, height and active norm filters and resets them", () => {
  render(
    <ChakraProvider value={defaultSystem}>
      <CatalogPanel
        items={[{ ...item, hasActiveNorm: true }]}
        permissions={permissionsForTest("admin")}
        onChanged={vi.fn()}
      />
    </ChakraProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Фильтры" }));
  expect(screen.queryByLabelText("Ростовка")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Размер")).not.toHaveAttribute("list");
  fireEvent.change(screen.getByLabelText("Тип СИЗ"), {
    target: { value: "BODY" },
  });
  fireEvent.change(screen.getByLabelText("Размер"), {
    target: { value: "96–100" },
  });
  fireEvent.change(screen.getByLabelText("Ростовка"), {
    target: { value: "170–176" },
  });
  fireEvent.change(screen.getByLabelText("В действующих нормах"), {
    target: { value: "true" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Применить" }));
  expect(screen.queryByText(item.article)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Фильтры" }));
  fireEvent.change(screen.getByLabelText("Размер"), {
    target: { value: "88–92" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Применить" }));
  expect(screen.getByText(item.article)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Фильтры" }));
  fireEvent.change(screen.getByLabelText("В действующих нормах"), {
    target: { value: "false" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Применить" }));
  expect(screen.queryByText(item.article)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Фильтры" }));
  fireEvent.click(screen.getByRole("button", { name: "Сбросить" }));
  expect(screen.getByText(item.article)).toBeInTheDocument();
});
it("opens row actions through a context menu and removes unit and actions columns", () => {
  render(
    <ChakraProvider value={defaultSystem}>
      <CatalogPanel items={[item]} permissions={permissionsForTest("admin")} onChanged={vi.fn()} />
    </ChakraProvider>,
  );
  expect(
    screen.queryByRole("button", { name: "Изменить" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText("Ед.")).not.toBeInTheDocument();
  expect(screen.queryByText("Действия")).not.toBeInTheDocument();
  const row = screen.getByText(item.article).closest("tr")!;
  fireEvent.contextMenu(row, { clientX: 500, clientY: 250 });
  expect(screen.getByRole("menu")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("menuitem", { name: "Изменить" }));
  expect(
    screen.getByRole("dialog", { name: "Редактирование СИЗ" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
});


it("returns to the original search query and module from a search result", () => {
  const returnTo = "#/search?q=куртка&module=ppe";
  window.history.replaceState(null, "", `#/ppe?tab=catalog&itemId=${item.id}&returnTo=${encodeURIComponent(returnTo)}`);
  render(<ChakraProvider value={defaultSystem}><CatalogPanel items={[item]} permissions={permissionsForTest("admin")} onChanged={vi.fn()} /></ChakraProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Назад" }));
  expect(decodeURI(window.location.hash)).toBe(returnTo);
  window.history.replaceState(null, "", "#/");
});


it("synchronizes itemId and q changes without remounting the catalog", () => {
  window.history.replaceState(null, "", "#/ppe?tab=catalog");
  const other = { ...item, id: item.id + 1, article: "99.123", name: "Другой СИЗ" };
  render(<ChakraProvider value={defaultSystem}><CatalogPanel items={[item, other]} permissions={permissionsForTest("admin")} onChanged={vi.fn()} /></ChakraProvider>);
  const input = screen.getByRole("textbox", { name: "Поиск по номенклатуре" });
  const navigate = (query: string) => act(() => {
    window.history.replaceState(null, "", "#/ppe?tab=catalog&" + query);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
  navigate(`itemId=${other.id}`);
  expect(input).toHaveValue(other.article);
  navigate(`itemId=${item.id}`);
  expect(input).toHaveValue(item.article);
  navigate("q=" + encodeURIComponent("Другой"));
  expect(input).toHaveValue("Другой");
  navigate("");
  expect(input).toHaveValue("");
  window.history.replaceState(null, "", "#/");
});

it("keeps the catalog read-only for the occupational safety specialist", () => {
  render(
    <ChakraProvider value={defaultSystem}>
      <CatalogPanel items={[item]} permissions={permissionsForTest("ppe_specialist")} onChanged={vi.fn()} />
    </ChakraProvider>,
  );
  expect(screen.getByText(item.article)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Добавить СИЗ" })).not.toBeInTheDocument();
  fireEvent.contextMenu(screen.getByText(item.article).closest("tr")!);
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
});

it("preserves manual search when catalog items refresh", () => {
  window.history.replaceState(null, "", "#/ppe?tab=catalog&q=original");
  const view = (items: typeof item[]) => (
    <ChakraProvider value={defaultSystem}>
      <CatalogPanel items={items} permissions={permissionsForTest("admin")} onChanged={vi.fn()} />
    </ChakraProvider>
  );
  const { rerender } = render(view([item]));
  const input = screen.getByRole("textbox", { name: "Поиск по номенклатуре" });
  fireEvent.change(input, { target: { value: "перчатки" } });
  rerender(view([{ ...item }]));
  expect(input).toHaveValue("перчатки");
  window.history.replaceState(null, "", "#/");
});

it("resolves a pending itemId once and uses refreshed items on later navigation", () => {
  window.history.replaceState(null, "", `#/ppe?tab=catalog&itemId=${item.id}`);
  const view = (items: typeof item[]) => (
    <ChakraProvider value={defaultSystem}>
      <CatalogPanel items={items} permissions={permissionsForTest("admin")} onChanged={vi.fn()} />
    </ChakraProvider>
  );
  const { rerender } = render(view([]));
  const input = screen.getByRole("textbox", { name: "Поиск по номенклатуре" });
  expect(input).toHaveValue("");
  rerender(view([item]));
  expect(input).toHaveValue(item.article);
  fireEvent.change(input, { target: { value: "перчатки" } });
  const updated = { ...item, article: "789" };
  rerender(view([updated]));
  expect(input).toHaveValue("перчатки");
  act(() => window.dispatchEvent(new HashChangeEvent("hashchange")));
  expect(input).toHaveValue(updated.article);
  window.history.replaceState(null, "", "#/");
});

it.each(["typing", "clearing"])("cancels pending itemId after manual %s", (action) => {
  window.history.replaceState(null, "", `#/ppe?tab=catalog&itemId=${item.id}&q=fallback`);
  const view = (items: typeof item[]) => (
    <ChakraProvider value={defaultSystem}>
      <CatalogPanel items={items} permissions={permissionsForTest("admin")} onChanged={vi.fn()} />
    </ChakraProvider>
  );
  const { rerender } = render(view([]));
  const input = screen.getByRole("textbox", { name: "Поиск по номенклатуре" });
  if (action === "typing") fireEvent.change(input, { target: { value: "перчатки" } });
  else fireEvent.click(screen.getByRole("button", { name: "Очистить поиск" }));
  rerender(view([item]));
  expect(input).toHaveValue(action === "typing" ? "перчатки" : "");
  window.history.replaceState(null, "", "#/");
});

it("marks inactive catalogue rows with the shared muted style", () => {
  const inactive = { ...item, id: item.id + 1, article: "INACTIVE", isActive: false };
  render(<ChakraProvider value={defaultSystem}>
    <CatalogPanel items={[item, inactive]} permissions={permissionsForTest("admin")} onChanged={vi.fn()} />
  </ChakraProvider>);
  expect(screen.getByText(inactive.article).closest("tr")).toHaveClass("ppe-inactive");
  expect(screen.getByText(item.article).closest("tr")).not.toHaveClass("ppe-inactive");
  expect(screen.getByText("Неактивная позиция")).toHaveClass("ppe-visually-hidden");
});
