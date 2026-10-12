import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ppeApi } from "../../shared/api/ppe";
import { ApiRequestError } from "../../shared/api/api-error";
import { CatalogPanel } from "./CatalogPanel";
import { SizeCatalogModal } from "./SizeCatalogModal";
import { NormFormModal } from "./NormFormModal";
import { item, norm } from "./ppe-test-fixtures";
import { defaultClothingSizes, defaultHeadSizes } from "../../modules/ppe-ui/ppe-size-options";
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe("PPE catalogue", () => {
  it("submits clothing size pairs together with a new item", async () => {
    vi.spyOn(ppeApi, "saveItem").mockResolvedValue(item);
    render(
      <ChakraProvider value={defaultSystem}>
        <CatalogPanel items={[]} role="admin" onChanged={vi.fn()} />
      </ChakraProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Добавить СИЗ" }));
    for (const [label, value] of [
      ["Артикул", "C-4"],
      ["Наименование", "Костюм"],
      ["Единица измерения", "пары"],
    ]) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    await waitFor(() =>
      expect(ppeApi.saveItem).toHaveBeenCalledWith(null, {
        article: "C-4",
        name: "Костюм",
        unit: "пары",
        type: "BODY",
        sizes: defaultClothingSizes().map((pair) => ({
          value: `${pair.value};${pair.heightValue}`,
        })),
      }),
    );
  });
  it("shows inactive items, searches by article and creates a typed item", async () => {
    vi.spyOn(ppeApi, "saveItem").mockResolvedValue(item);
    const onChanged = vi.fn();
    render(
      <ChakraProvider value={defaultSystem}>
        <CatalogPanel
          items={[
            item,
            {
              ...item,
              id: 20,
              name: "Ботинки",
              article: "B-2",
              type: "FEET",
              isActive: false,
            },
          ]}
          role="admin"
          onChanged={onChanged}
        />
      </ChakraProvider>,
    );
    fireEvent.change(screen.getByLabelText("Поиск по номенклатуре"), {
      target: { value: "B-2" },
    });
    expect(screen.queryByText("Костюм")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Добавить СИЗ" }));
    fireEvent.change(screen.getByLabelText("Артикул"), {
      target: { value: "C-3" },
    });
    fireEvent.change(screen.getByLabelText("Наименование"), {
      target: { value: "Каска" },
    });
    fireEvent.change(screen.getByLabelText("Единица измерения"), {
      target: { value: "пары" },
    });
    fireEvent.change(screen.getByLabelText("Тип"), {
      target: { value: "HEAD" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    await waitFor(() =>
      expect(ppeApi.saveItem).toHaveBeenCalledWith(null, {
        article: "C-3",
        name: "Каска",
        unit: "шт",
        type: "HEAD",
        sizes: defaultHeadSizes().map((value) => ({ value })),
      }),
    );
    expect(onChanged).toHaveBeenCalledOnce();
  });
  it("creates a BODY pair and preserves its two components", async () => {
    vi.spyOn(ppeApi, "replaceSizes").mockResolvedValue([]);
    render(
      <SizeCatalogModal
        item={item}
        manage
        onChanged={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("Редактировать размеры"));
    fireEvent.change(screen.getByLabelText("Размер"), {
      target: { value: "88–92" },
    });
    fireEvent.change(screen.getByLabelText("Ростовка"), {
      target: { value: "182–188" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Добавить" }));
    fireEvent.click(screen.getByRole("button", { name: "Сохранить размеры" }));
    await waitFor(() =>
      expect(ppeApi.replaceSizes).toHaveBeenCalledWith(3, [
        { value: "88–92;158–164" },
        { value: "88–92;170–176" },
        { value: "88–92;182–188" },
      ]),
    );
  });
  it("omits height for FEET and shows a backend pair conflict without closing", async () => {
    vi.spyOn(ppeApi, "replaceSizes").mockRejectedValue(
      new ApiRequestError("Conflict", 409, "PPE_ITEM_SIZE_CONFLICT"),
    );
    render(
      <ChakraProvider value={defaultSystem}>
        <SizeCatalogModal
          item={{
            ...item,
            type: "FEET",
            sizes: item.sizes.slice(0, 2).map((size, index) => ({
              ...size,
              value: String(42 + index),
              heightValue: null,
            })),
          }}
          manage
          onChanged={vi.fn()}
          onClose={vi.fn()}
        />
      </ChakraProvider>,
    );
    fireEvent.click(screen.getByText(/Редактировать размеры/));
    fireEvent.click(screen.getByRole("button", { name: "Удалить размер 43" }));
    expect(screen.queryByLabelText("Ростовка")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Размер вручную"), {
      target: { value: "44" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Добавить размер" }));
    fireEvent.click(screen.getByRole("button", { name: "Сохранить размеры" }));
    await screen.findByRole("alert");
    expect(ppeApi.replaceSizes).toHaveBeenCalledWith(3, [
      { value: "42" },
      { value: "44" },
    ]);
    expect(
      screen.getByRole("button", { name: "Удалить размер 44" }),
    ).toBeInTheDocument();
  });
});
describe("PPE norm editor", () => {
  it("saves a hard transition and a daily period without a mode selector", async () => {
    vi.spyOn(ppeApi, "saveNorm").mockResolvedValue(norm);
    render(
      <NormFormModal
        state={{ mode: "revision", norm }}
        position={{ id: 2, name: "Инженер", isActive: true }}
        items={[item]}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );
    const toggle = screen.getByRole("switch", { name: "Жёсткий переход" });
    expect(toggle).not.toBeChecked();
    fireEvent.click(toggle);
    expect(toggle).toBeChecked();
    fireEvent.click(screen.getByLabelText("Как работают переходы"));
    expect(screen.getByText(/Выключено — мягкий переход/)).toBeVisible();
    expect(screen.queryByLabelText("Расчёт выдачи")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Единица периода"), { target: { value: "DAY" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить норму" }));
    await waitFor(() =>
      expect(ppeApi.saveNorm).toHaveBeenCalledWith(
        "revision",
        9,
        2,
        expect.objectContaining({
          transitionMode: "HARD",
          items: [expect.objectContaining({ periodUnit: "DAY" })],
        }),
      ),
    );
  });
  it("copies the full revision composition, omitting previous row IDs", async () => {
    vi.spyOn(ppeApi, "saveNorm").mockResolvedValue(norm);
    render(
      <NormFormModal
        state={{ mode: "revision", norm }}
        position={{ id: 2, name: "Инженер", isActive: true }}
        items={[item]}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Дата начала"), {
      target: { value: "2099-02-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить норму" }));
    await waitFor(() =>
      expect(ppeApi.saveNorm).toHaveBeenCalledWith("revision", 9, 2, {
        effectiveFrom: "2099-02-01",
        effectiveTo: null,
        transitionMode: "SOFT",
        items: [
          {
            ppeItemId: 3,
            quantity: 2,
            periodCount: 1,
            periodUnit: "YEAR",
          },
        ],
      }),
    );
  });
  it("prevents a duplicate item in another row and handles a locked future norm", async () => {
    vi.spyOn(ppeApi, "saveNorm").mockRejectedValue(
      new ApiRequestError("Locked", 409, "PPE_NORM_LOCKED"),
    );
    render(
      <NormFormModal
        state={{ mode: "edit", norm }}
        position={{ id: 2, name: "Инженер", isActive: true }}
        items={[item]}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Добавить" }));
    fireEvent.click(screen.getByRole("button", { name: "Выберите СИЗ" }));
    expect(screen.getByRole("option", { name: /A-01/ })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole("option", { name: "Выберите СИЗ" }), {
      key: "Escape",
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Удалить" })[1]);
    fireEvent.click(screen.getByRole("button", { name: "Сохранить норму" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Норму уже нельзя изменить.",
    );
  });
});
