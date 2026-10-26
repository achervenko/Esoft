import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AppTable } from "./AppTable";
import { DataTable } from "./DataTable";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const items = Array.from({ length: 205 }, (_, id) => ({
  id,
  name: String(205 - id).padStart(3, "0"),
}));
function wrapper({ children }: { children: React.ReactNode }) {
  return <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;
}

it("sorts the complete local dataset before revealing batches and resets on sorting", () => {
  render(
    <DataTable
      rows={items}
      getRowKey={(row) => row.id}
      defaultSort={{ key: "name", direction: "asc" }}
      columns={[
        {
          key: "name",
          label: "Имя",
          render: (row) => row.name,
          sortValue: (row) => row.name,
        },
      ]}
    />,
    { wrapper },
  );
  expect(screen.getAllByRole("row")).toHaveLength(101);
  expect(screen.getAllByRole("row")[1]).toHaveTextContent("001");
  fireEvent.click(screen.getByRole("button", { name: "Показать ещё" }));
  expect(screen.getAllByRole("row")).toHaveLength(201);
  fireEvent.click(screen.getByRole("button", { name: "Сортировать: Имя" }));
  expect(screen.getAllByRole("row")).toHaveLength(101);
  expect(screen.getAllByRole("row")[1]).toHaveTextContent("205");
  fireEvent.click(screen.getByRole("button", { name: "Показать ещё" }));
  fireEvent.click(screen.getByRole("button", { name: "Показать ещё" }));
  expect(screen.getAllByRole("row")).toHaveLength(206);
  expect(screen.queryByRole("button", { name: "Показать ещё" })).toBeNull();
});

it("reveals raw AppTable rows across multiple bodies without slicing headers or losing input state", () => {
  render(
    <AppTable>
      <thead>
        <tr>
          <th>Имя</th>
        </tr>
      </thead>
      <tbody>
        {items.slice(0, 120).map((row) => (
          <tr key={row.id}>
            <td>{row.name}</td>
          </tr>
        ))}
      </tbody>
      <tbody>
        {items.slice(120).map((row) => (
          <tr key={row.id}>
            <td>
              <input aria-label={`Строка ${row.id}`} defaultValue={row.name} />
            </td>
          </tr>
        ))}
      </tbody>
    </AppTable>,
    { wrapper },
  );
  expect(screen.getAllByRole("row")).toHaveLength(101);
  fireEvent.click(screen.getByRole("button", { name: "Показать ещё" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Строка 120" }), {
    target: { value: "Черновик" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Показать ещё" }));
  expect(screen.getByRole("textbox", { name: "Строка 120" })).toHaveValue(
    "Черновик",
  );
  expect(screen.getAllByRole("row")).toHaveLength(206);
  expect(screen.getByRole("columnheader", { name: "Имя" })).toBeTruthy();
});

it("does not add a footer for a small list or a second loader for a server-managed table", () => {
  const columns = [
    {
      key: "name",
      label: "Имя",
      render: (row: (typeof items)[number]) => row.name,
    },
  ];
  const { rerender } = render(
    <DataTable
      rows={items.slice(0, 2)}
      columns={columns}
      getRowKey={(row) => row.id}
      defaultSort={{ key: "name", direction: "asc" }}
    />,
    { wrapper },
  );
  expect(screen.queryByText(/Показано/)).toBeNull();
  rerender(
    <DataTable
      rows={items}
      columns={columns}
      getRowKey={(row) => row.id}
      defaultSort={{ key: "name", direction: "asc" }}
      serverSorted
    />,
  );
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(
    206,
  );
  expect(screen.queryByRole("button", { name: "Показать ещё" })).toBeNull();
});

it("automatically reveals a batch when its sentinel intersects", () => {
  const callbacks: IntersectionObserverCallback[] = [];
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        callbacks.push(callback);
      }
      observe() {}
      disconnect() {}
    },
  );
  render(
    <AppTable>
      <tbody>
        {items.map((row) => (
          <tr key={row.id}>
            <td>{row.name}</td>
          </tr>
        ))}
      </tbody>
    </AppTable>,
    { wrapper },
  );
  act(() =>
    callbacks[0](
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    ),
  );
  expect(screen.getAllByRole("row")).toHaveLength(200);
});
