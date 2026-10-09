import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ppeApi } from "../../shared/api/ppe";
import { SizeCatalogModal } from "./SizeCatalogModal";
import { item } from "./ppe-test-fixtures";
import { defaultClothingSizes } from "./ppe-size-options";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("saves an individual glove size without invoking bulk replacement", async () => {
  const save = vi.spyOn(ppeApi, "saveSize").mockResolvedValue(item.sizes[0]);
  const replace = vi.spyOn(ppeApi, "replaceSizes").mockResolvedValue([]);
  const onChanged = vi.fn();
  render(
    <ChakraProvider value={defaultSystem}>
      <SizeCatalogModal
        item={{ ...item, type: "HANDS", sizes: [] }}
        manage
        onClose={vi.fn()}
        onChanged={onChanged}
      />
    </ChakraProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Добавить размер" }));
  fireEvent.change(screen.getByLabelText("Размер"), { target: { value: "9" } });
  fireEvent.click(screen.getByRole("button", { name: "Сохранить размер" }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(item.id, null, { value: "9" }),
  );
  await waitFor(() => expect(onChanged).toHaveBeenCalledOnce());
  expect(replace).not.toHaveBeenCalled();
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
