import type { ReactElement } from "react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ManufacturersDictionaryPanel } from "./ManufacturersDictionaryPanel";
import { LocationsDictionaryPanel } from "./LocationsDictionaryPanel";

const parents = [
  { id: 1, name: "Первый" },
  { id: 2, name: "Второй" },
];
const models = [
  { id: 1, name: "Модель A", manufacturerId: 1, manufacturer: parents[0] },
  { id: 2, name: "Модель B", manufacturerId: 2, manufacturer: parents[1] },
];
const locations = [
  { id: 1, name: "Участок A", workshopId: 1, workshop: parents[0] },
  { id: 2, name: "Участок B", workshopId: 2, workshop: parents[1] },
];

type FilterCase = {
  name: string;
  parentName: string;
  childName: string;
  first: string;
  second: string;
  panel: (
    selectedParentExists?: boolean,
    onCreateChild?: (parentId: number | null) => void,
  ) => ReactElement;
};

function parentTable(name: string) {
  return within(screen.getByRole("region", { name })).getByRole("table");
}

const cases: FilterCase[] = [
  {
    name: "models",
    parentName: "Производители",
    childName: "Модели",
    first: "Модель A",
    second: "Модель B",
    panel: (
      selectedParentExists = true,
      onCreateChild: (parentId: number | null) => void = vi.fn(),
    ) => (
      <ManufacturersDictionaryPanel
        manufacturers={selectedParentExists ? parents : parents.slice(1)}
        models={models}
        onCreateManufacturer={vi.fn()}
        onCreateModel={onCreateChild}
        onDeleteManufacturer={vi.fn()}
        onDeleteModel={vi.fn()}
        onEditManufacturer={vi.fn()}
        onEditModel={vi.fn()}
      />
    ),
  },
  {
    name: "locations",
    parentName: "Объекты",
    childName: "Местонахождения",
    first: "Участок A",
    second: "Участок B",
    panel: (
      selectedParentExists = true,
      onCreateChild: (parentId: number | null) => void = vi.fn(),
    ) => (
      <LocationsDictionaryPanel
        objects={selectedParentExists ? parents : parents.slice(1)}
        locations={locations}
        onCreateLocation={onCreateChild}
        onCreateObject={vi.fn()}
        onDeleteLocation={vi.fn()}
        onDeleteObject={vi.fn()}
        onEditLocation={vi.fn()}
        onEditObject={vi.fn()}
      />
    ),
  },
];

it.each(cases)(
  "filters $name by parent and allows returning to all",
  ({ panel, first, second, parentName }) => {
    render(<ChakraProvider value={defaultSystem}>{panel()}</ChakraProvider>);
    expect(screen.getByText(first)).toBeInTheDocument();
    expect(screen.getByText(second)).toBeInTheDocument();
    fireEvent.click(
      within(parentTable(parentName)).getByRole("row", { name: /Первый/ }),
    );
    expect(screen.getByText(first)).toBeInTheDocument();
    expect(screen.queryByText(second)).toBeNull();
    // The parent list remains available while its children are filtered.
    expect(
      within(parentTable(parentName)).getByText("Второй"),
    ).toBeInTheDocument();
    const selected = within(parentTable(parentName)).getByRole("row", {
      name: /Первый/,
    });
    expect(selected).toHaveAttribute("aria-selected", "true");
    fireEvent.click(selected);
    expect(selected).toHaveAttribute("aria-selected", "false");
    expect(screen.getByText(second)).toBeInTheDocument();
  },
);

it.each(cases)(
  "clears a removed parent filter for $name",
  ({ panel, second, parentName }) => {
    const { rerender } = render(
      <ChakraProvider value={defaultSystem}>{panel()}</ChakraProvider>,
    );
    fireEvent.click(
      within(parentTable(parentName)).getByRole("row", { name: /Первый/ }),
    );
    rerender(
      <ChakraProvider value={defaultSystem}>{panel(false)}</ChakraProvider>,
    );
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByText(second)).toBeInTheDocument();
  },
);

it.each(cases)(
  "supports keyboard selection without triggering $name filters from action buttons",
  ({ panel, first, second, parentName }) => {
    render(<ChakraProvider value={defaultSystem}>{panel()}</ChakraProvider>);
    const row = within(parentTable(parentName)).getByRole("row", {
      name: /Первый/,
    });
    for (const button of within(row).getAllByRole("button"))
      fireEvent.click(button);
    expect(row).toHaveAttribute("aria-selected", "false");
    expect(screen.getByText(second)).toBeInTheDocument();
    fireEvent.keyDown(row, { key: "Enter" });
    expect(row).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText(first)).toBeInTheDocument();
    expect(screen.queryByText(second)).toBeNull();
  },
);

it.each(cases)(
  "passes the selected parent when creating $name",
  ({ panel, parentName, childName }) => {
    const onCreate = vi.fn();
    render(
      <ChakraProvider value={defaultSystem}>
        {panel(true, onCreate)}
      </ChakraProvider>,
    );
    const add = within(
      screen.getByRole("region", { name: childName }),
    ).getByRole("button", { name: "Добавить" });
    fireEvent.click(add);
    expect(onCreate).toHaveBeenLastCalledWith(null);
    const row = within(parentTable(parentName)).getByRole("row", {
      name: /Второй/,
    });
    fireEvent.click(row);
    fireEvent.click(add);
    expect(onCreate).toHaveBeenLastCalledWith(2);
    fireEvent.click(row);
    fireEvent.click(add);
    expect(onCreate).toHaveBeenLastCalledWith(null);
  },
);
