import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ApiRequestError } from "../../shared/api/api-error";
import { ppeApi, type PpeItem } from "../../shared/api/ppe";
import { CatalogItemForm } from "./CatalogItemForm";
import { item } from "./ppe-test-fixtures";

const existing: PpeItem = { ...item, article: "00123", type: "OTHER" };

afterEach(() => vi.restoreAllMocks());

function renderForm(items: PpeItem[], editing: PpeItem | null = null) {
  return render(
    <CatalogItemForm item={editing} items={items} onClose={vi.fn()} onChanged={vi.fn()} />,
  );
}

it.each([true, false])("rejects an existing article immediately (active=%s)", (isActive) => {
  const save = vi.spyOn(ppeApi, "saveItem").mockResolvedValue(existing);
  renderForm([{ ...existing, isActive }]);
  const input = screen.getByLabelText("Артикул");
  fireEvent.change(input, { target: { value: " 00123 " } });
  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByText(/Этот артикул уже используется/)).toBeInTheDocument();
  if (!isActive) expect(screen.getByText(/Позиция неактивна/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Сохранить" })).toBeDisabled();
  fireEvent.submit(input.closest("form")!);
  expect(save).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: "001234" } });
  expect(input).not.toHaveAttribute("aria-invalid");
  expect(screen.getByRole("button", { name: "Сохранить" })).toBeEnabled();
});

it("allows the current article and a duplicate name with another article", async () => {
  const save = vi.spyOn(ppeApi, "saveItem").mockResolvedValue(existing);
  renderForm([existing, { ...existing, id: existing.id + 1, article: "456" }], existing);
  expect(screen.getByLabelText("Артикул")).not.toHaveAttribute("aria-invalid");
  fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
  await waitFor(() => expect(save).toHaveBeenCalledWith(existing.id, {
    article: existing.article, name: existing.name, type: existing.type, unit: existing.unit,
  }));
});

it("shows a server article conflict under the field and clears it after correction", async () => {
  vi.spyOn(ppeApi, "saveItem").mockRejectedValue(
    new ApiRequestError("Conflict", 409, "PPE_ITEM_ARTICLE_CONFLICT"),
  );
  renderForm([], existing);
  const input = screen.getByLabelText("Артикул");
  fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
  await waitFor(() => expect(input).toHaveAttribute("aria-invalid", "true"));
  expect(screen.getByText("СИЗ с таким артикулом уже существует.")).toHaveClass("field-error");
  fireEvent.change(input, { target: { value: "789" } });
  expect(screen.getByLabelText("Артикул")).not.toHaveAttribute("aria-invalid");
  expect(screen.getByRole("button", { name: "Сохранить" })).toBeEnabled();
});

it("warns about all duplicate names without blocking save and excludes the current item", async () => {
  const save = vi.spyOn(ppeApi, "saveItem").mockResolvedValue(existing);
  renderForm([
    existing,
    { ...existing, id: existing.id + 1, article: "456" },
    { ...existing, id: existing.id + 2, article: "789", isActive: false },
  ], existing);
  const input = screen.getByRole("textbox", { name: /Наименование/ });
  const warning = screen.getByText(/Такое наименование уже есть/);
  expect(warning).toHaveClass("field-warning");
  expect(warning).toHaveTextContent("456, 789 (позиция неактивна)");
  expect(warning).not.toHaveTextContent(existing.article);
  expect(input).not.toHaveAttribute("aria-invalid");
  expect(screen.getByRole("button", { name: "Сохранить" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  fireEvent.change(input, { target: { value: "Другое название" } });
  expect(screen.queryByText(/Такое наименование уже есть/)).not.toBeInTheDocument();
});

it("does not warn when only the edited item's own name matches", () => {
  renderForm([existing], existing);
  expect(screen.queryByText(/Такое наименование уже есть/)).not.toBeInTheDocument();
});
