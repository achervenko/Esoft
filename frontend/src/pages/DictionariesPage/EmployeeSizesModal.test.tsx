import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EmployeeSizesModal } from "./EmployeeSizesModal";
import { PpeEmployeesPanel } from "./PpeEmployeesPanel";
import { ppeApi } from "../../shared/api/ppe";
import { employee } from "../PpePage/ppe-test-fixtures";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("blocks duplicate submits and allows retry after a failed PATCH", async () => {
  vi.spyOn(ppeApi, "employee").mockResolvedValue(employee);
  let reject!: (error: Error) => void;
  const save = vi.spyOn(ppeApi, "employeeSizes")
    .mockResolvedValue(employee)
    .mockReturnValueOnce(new Promise((_, fail) => { reject = fail; }));
  const onClose = vi.fn();
  const onChanged = vi.fn();
  render(<EmployeeSizesModal id={1} onClose={onClose} onChanged={onChanged} />);
  fireEvent.change(await screen.findByLabelText("Размер обуви"), { target: { value: "42.5" } });
  const form = screen.getByRole("button", { name: "Сохранить размеры" }).closest("form")!;
  act(() => {
    fireEvent.submit(form);
    fireEvent.submit(form);
  });
  expect(save).toHaveBeenCalledExactlyOnceWith(employee.id, { shoeSize: 42.5 });
  expect(screen.getByRole("button", { name: "Сохранение..." })).toBeDisabled();
  await act(async () => { reject(new Error("Request failed")); });
  expect(onClose).not.toHaveBeenCalled();
  expect(onChanged).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Сохранить размеры" })).toBeEnabled();
  await act(async () => { fireEvent.submit(form); });
  expect(save).toHaveBeenCalledTimes(2);
  expect(onChanged).toHaveBeenCalledOnce();
  expect(onClose).toHaveBeenCalledOnce();
});
it("saves the independent T-shirt pair without changing clothing sizes", async () => {
  vi.spyOn(ppeApi, "employee").mockResolvedValue(employee);
  vi.spyOn(ppeApi, "employeeSizes").mockResolvedValue(employee);
  render(<EmployeeSizesModal id={1} onClose={vi.fn()} />);
  const tshirt = within(
    await screen.findByRole("group", { name: "Размер футболки и ростовка" }),
  );
  fireEvent.click(tshirt.getByRole("button", { name: "Изменить" }));
  fireEvent.click(tshirt.getByRole("button", { name: "100;170–176" }));
  fireEvent.click(screen.getByRole("button", { name: "Сохранить размеры" }));
  await waitFor(() =>
    expect(ppeApi.employeeSizes).toHaveBeenCalledWith(1, {
      tshirtSize: "100",
      tshirtHeight: "170–176",
    }),
  );
});
it("patches only changed size fields and clears empty values as null", async () => {
  vi.spyOn(ppeApi, "employee").mockResolvedValue(employee);
  vi.spyOn(ppeApi, "employeeSizes").mockResolvedValue(employee);
  render(<EmployeeSizesModal id={1} onClose={vi.fn()} />);
  fireEvent.click(
    within(
      await screen.findByRole("group", { name: "Размер одежды и ростовка" }),
    ).getByRole("button", { name: "Изменить" }),
  );
  const clothing = await screen.findByRole("button", {
    name: `${employee.ppeSizes!.clothingSize};${employee.ppeSizes!.clothingHeight}`,
  });
  expect(
    screen.getByRole("button", { name: "Сохранить размеры" }),
  ).toBeDisabled();
  fireEvent.click(clothing);
  fireEvent.change(screen.getByLabelText("Размер обуви"), {
    target: { value: "42.5" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Сохранить размеры" }));
  await waitFor(() =>
    expect(ppeApi.employeeSizes).toHaveBeenCalledWith(1, {
      clothingSize: null,
      clothingHeight: null,
      shoeSize: 42.5,
    }),
  );
});
it("shows clothing and T-shirt pairs and the other dimensions for specialists without employee administrative actions", async () => {
  vi.spyOn(ppeApi, "employees").mockResolvedValue([employee]);
  render(
    <ChakraProvider value={defaultSystem}>
      <PpeEmployeesPanel />
    </ChakraProvider>,
  );
  await screen.findByText("Червенко Алехандро");
  expect(
    screen.getByText(
      `${employee.ppeSizes!.clothingSize}; ${employee.ppeSizes!.clothingHeight}`,
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      `${employee.ppeSizes!.tshirtSize}; ${employee.ppeSizes!.tshirtHeight}`,
    ),
  ).toBeInTheDocument();
  expect(screen.queryByText("Ростовка:")).not.toBeInTheDocument();
  expect(screen.getByText("Размер перчаток:")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Изменить" })).toBeInTheDocument();
  expect(screen.queryByText("Действия")).not.toBeInTheDocument();
  fireEvent.contextMenu(screen.getByText("Червенко Алехандро"));
  expect(
    screen.getByRole("menuitem", { name: "Изменить" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Отключить" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Добавить" }),
  ).not.toBeInTheDocument();
});

it("replaces the employee clothing pair with one selected option", async () => {
  vi.spyOn(ppeApi, "employee").mockResolvedValue(employee);
  vi.spyOn(ppeApi, "employeeSizes").mockResolvedValue(employee);
  render(<EmployeeSizesModal id={1} onClose={vi.fn()} />);
  const toggle = within(
    await screen.findByRole("group", { name: "Размер одежды и ростовка" }),
  ).getByRole("button", { name: "Изменить" });
  expect(
    screen.queryByRole("button", { name: "96–100;182–188" }),
  ).not.toBeInTheDocument();
  fireEvent.click(toggle);
  const pair = await screen.findByRole("button", { name: "96–100;182–188" });
  fireEvent.click(pair);
  expect(screen.getByText("96–100; 182–188")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "96–100;182–188" }),
  ).not.toBeInTheDocument();
  expect(toggle).toHaveFocus();
  fireEvent.click(
    within(
      screen.getByRole("group", { name: "Размер одежды и ростовка" }),
    ).getByRole("button", { name: "Изменить" }),
  );
  expect(
    screen.getByRole("button", { name: "96–100;182–188" }),
  ).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Сохранить размеры" }));
  await waitFor(() =>
    expect(ppeApi.employeeSizes).toHaveBeenCalledWith(1, {
      clothingSize: "96–100",
      clothingHeight: "182–188",
    }),
  );
});

it.each([
  { clothingSize: "88–92", clothingHeight: null },
  { clothingSize: null, clothingHeight: "170–176" },
])(
  "does not create an empty grid axis for incomplete clothing fields %j",
  async (sizes) => {
    vi.spyOn(ppeApi, "employee").mockResolvedValue({
      ...employee,
      ppeSizes: { ...employee.ppeSizes!, ...sizes },
    });
    render(<EmployeeSizesModal id={1} onClose={vi.fn()} />);
    await screen.findByRole("button", { name: "88–92;170–176" });
    const cells = screen
      .getByRole("group", { name: "Размер одежды и ростовка" })
      .querySelectorAll<HTMLButtonElement>(
        ".ppe-clothing-height-options button",
      );
    expect(cells).toHaveLength(24);
    for (const cell of cells) {
      expect(cell.getAttribute("aria-label")).toMatch(/^.+;.+$/);
      expect(cell).toHaveAttribute("aria-pressed", "false");
    }
    expect(
      screen.getByRole("button", { name: "Сохранить размеры" }),
    ).toBeDisabled();
  },
);

it("edits sizes when the employee has no PPE sizes row", async () => {
  vi.spyOn(ppeApi, "employee").mockResolvedValue({
    ...employee,
    ppeSizes: null,
  });
  vi.spyOn(ppeApi, "employeeSizes").mockResolvedValue(employee);
  render(<EmployeeSizesModal id={1} onClose={vi.fn()} />);
  await screen.findByLabelText("Размер обуви");
  expect(
    screen.getByRole("button", { name: "Сохранить размеры" }),
  ).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Размер обуви"), {
    target: { value: "42.5" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Сохранить размеры" }));
  await waitFor(() =>
    expect(ppeApi.employeeSizes).toHaveBeenCalledWith(1, { shoeSize: 42.5 }),
  );
});
