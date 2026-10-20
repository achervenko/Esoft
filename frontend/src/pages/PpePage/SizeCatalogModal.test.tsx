import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ppeApi } from "../../shared/api/ppe";
import { SizeCatalogModal } from "./SizeCatalogModal";
import { SizeListEditor } from "./SizeListEditor";
import { item } from "./ppe-test-fixtures";
import { defaultClothingSizes } from "../../modules/ppe-ui/ppe-size-options";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each(["new", "existing"])("blocks duplicate %s size submits and unlocks after failure", async (mode) => {
  let reject!: (error: Error) => void;
  const size = item.sizes[0];
  const save = vi.spyOn(ppeApi, "saveSize")
    .mockResolvedValue(size)
    .mockReturnValueOnce(new Promise((_, fail) => { reject = fail; }));
  const onChanged = vi.fn();
  render(
    <ChakraProvider value={defaultSystem}>
      <SizeListEditor item={{ ...item, sizes: mode === "new" ? [] : [size] }} manage onClose={vi.fn()} onChanged={onChanged} />
    </ChakraProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: mode === "new" ? "Добавить размер" : "Изменить" }));
  fireEvent.change(screen.getByLabelText("Размер"), { target: { value: "52" } });
  fireEvent.change(screen.getByLabelText("Ростовка"), { target: { value: "182–188" } });
  const form = screen.getByRole("button", { name: "Сохранить размер" }).closest("form")!;
  act(() => {
    fireEvent.submit(form);
    fireEvent.submit(form);
  });
  expect(save).toHaveBeenCalledTimes(1);
  expect(save).toHaveBeenCalledWith(item.id, mode === "new" ? null : size.id, { value: "52", heightValue: "182–188" });
  expect(screen.getByRole("button", { name: "Сохранение..." })).toBeDisabled();
  await act(async () => { reject(new Error("Request failed")); });
  expect(onChanged).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Сохранить размер" })).toBeEnabled();
  await act(async () => { fireEvent.submit(form); });
  expect(save).toHaveBeenCalledTimes(2);
  expect(onChanged).toHaveBeenCalledOnce();
  expect(screen.queryByRole("button", { name: "Сохранить размер" })).not.toBeInTheDocument();
});

it("blocks concurrent grid saves and allows retry after failure", async () => {
  let reject!: (error: Error) => void;
  const replace = vi.spyOn(ppeApi, "replaceSizes")
    .mockResolvedValue([])
    .mockReturnValueOnce(new Promise((_, fail) => { reject = fail; }));
  const onChanged = vi.fn();
  const onClose = vi.fn();
  render(
    <ChakraProvider value={defaultSystem}>
      <SizeCatalogModal item={item} manage onClose={onClose} onChanged={onChanged} />
    </ChakraProvider>,
  );
  const button = screen.getByRole("button", { name: "Сохранить размеры" });
  act(() => {
    button.click();
    button.click();
  });
  expect(replace).toHaveBeenCalledTimes(1);
  expect(button).toBeDisabled();
  await act(async () => { reject(new Error("Request failed")); });
  expect(button).toBeEnabled();
  expect(onChanged).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.click(button);
  await waitFor(() => expect(replace).toHaveBeenCalledTimes(2));
  expect(onChanged).toHaveBeenCalledOnce();
  expect(onClose).toHaveBeenCalledOnce();
});

it("edits glove sizes through the shared range and replaces the size set", async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  const save = vi.spyOn(ppeApi, "saveSize");
  const replace = vi.spyOn(ppeApi, "replaceSizes").mockResolvedValue([]);
  const onChanged = vi.fn();
  const onClose = vi.fn();
  render(
    <ChakraProvider value={defaultSystem}>
      <SizeCatalogModal
        item={{ ...item, type: "HANDS", sizes: [] }}
        manage
        onClose={onClose}
        onChanged={onChanged}
      />
    </ChakraProvider>,
  );
  const sliders = await screen.findAllByRole("slider");
  expect(sliders[0]).toHaveAttribute("aria-valuemin", "6");
  expect(sliders[1]).toHaveAttribute("aria-valuemax", "15");
  fireEvent.click(screen.getByText("Редактировать размеры (0)"));
  fireEvent.change(screen.getByLabelText("Размер вручную"), { target: { value: "9" } });
  fireEvent.click(screen.getByRole("button", { name: "Добавить размер" }));
  expect(screen.getByRole("button", { name: "Удалить размер 9" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Сохранить размеры" }));
  await waitFor(() => expect(replace).toHaveBeenCalledExactlyOnceWith(item.id, [{ value: "9" }]));
  expect(onChanged).toHaveBeenCalledOnce();
  expect(onClose).toHaveBeenCalledOnce();
  expect(save).not.toHaveBeenCalled();
});

it("shows clothing sizes as a read-only table without a bulk editor", () => {
  render(
    <ChakraProvider value={defaultSystem}>
      <SizeCatalogModal
        item={item}
        manage={false}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />
    </ChakraProvider>,
  );
  expect(screen.getByRole("table")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Сохранить размеры" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Изменить" }),
  ).not.toBeInTheDocument();
});

it.each(["empty", "inactive"])("offers and saves the default clothing grid for %s sizes", async (kind) => {
  const replace = vi.spyOn(ppeApi, "replaceSizes").mockResolvedValue([]);
  const sizes = kind === "empty" ? [] : item.sizes.map((size) => ({ ...size, isActive: false }));
  render(
    <ChakraProvider value={defaultSystem}>
      <SizeCatalogModal item={{ ...item, sizes }} manage onClose={vi.fn()} onChanged={vi.fn()} />
    </ChakraProvider>,
  );
  expect(screen.getByText("Активных размеров пока нет.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "88–92;158–164" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Сохранить размеры" }));
  await waitFor(() => expect(replace).toHaveBeenCalledWith(item.id,
    defaultClothingSizes().map((size) => ({ value: `${size.value};${size.heightValue}` })),
  ));
});

it("preserves an existing active clothing grid and excludes inactive sizes", async () => {
  const replace = vi.spyOn(ppeApi, "replaceSizes").mockResolvedValue([]);
  render(
    <ChakraProvider value={defaultSystem}>
      <SizeCatalogModal item={item} manage onClose={vi.fn()} onChanged={vi.fn()} />
    </ChakraProvider>,
  );
  expect(screen.queryByText("Активных размеров пока нет.")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Сохранить размеры" }));
  await waitFor(() => expect(replace).toHaveBeenCalledWith(item.id,
    item.sizes.filter((size) => size.isActive).map((size) => ({ value: `${size.value};${size.heightValue}` })),
  ));
});
