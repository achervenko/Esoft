import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CatalogPanel } from "./CatalogPanel";
import { item } from "./ppe-test-fixtures";

afterEach(cleanup);
it("combines size, height and active norm filters and resets them", () => {
  render(
    <ChakraProvider value={defaultSystem}>
      <CatalogPanel
        items={[{ ...item, hasActiveNorm: true }]}
        role="admin"
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
      <CatalogPanel items={[item]} role="admin" onChanged={vi.fn()} />
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
