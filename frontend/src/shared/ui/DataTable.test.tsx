import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DataTable } from "./DataTable";

afterEach(cleanup);

it("sorts value columns while leaving actions and explicitly disabled columns unsortable", () => {
  render(
    <ChakraProvider value={defaultSystem}>
    <DataTable
      rows={[{ id: 1, name: "Б" }, { id: 2, name: "А" }]}
      getRowKey={(row) => row.id}
      defaultSort={{ key: "name", direction: "asc" }}
      columns={[
        { key: "name", label: "Имя", render: (row) => row.name, sortValue: (row) => row.name },
        { key: "id", label: "ID", isSortable: false, render: (row) => row.id, sortValue: (row) => row.id },
        { key: "actions", className: "admin-table-actions-column", label: "", render: () => <button>Открыть</button> },
      ]}
    />
    </ChakraProvider>,
  );
  const headers = screen.getAllByRole("columnheader");
  expect(within(headers[1]).queryByRole("button")).toBeNull();
  expect(within(headers[2]).queryByRole("button")).toBeNull();
  expect(headers[2]).toHaveClass("admin-table-actions-column");
  expect(screen.getAllByRole("row")[1]).toHaveTextContent("А");
  fireEvent.click(screen.getByRole("button", { name: "Сортировать: Имя" }));
  expect(screen.getAllByRole("row")[1]).toHaveTextContent("Б");
});
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

it("keeps server order and delegates sorting without sorting the current page", () => {
  const onSortChange = vi.fn();
  render(<ChakraProvider value={defaultSystem}><DataTable
    rows={[{ id: 1, name: 'Б' }, { id: 2, name: 'А' }]}
    columns={[{ key: 'name', label: 'Имя', render: (row) => row.name, sortValue: (row) => row.name }]}
    defaultSort={{ key: 'name', direction: 'asc' }} sort={{ key: 'name', direction: 'asc' }}
    serverSorted onSortChange={onSortChange} getRowKey={(row) => row.id}
  /></ChakraProvider>);
  expect(screen.getAllByRole('row')[1]).toHaveTextContent('Б');
  fireEvent.click(screen.getByRole('button', { name: 'Сортировать: Имя' }));
  expect(onSortChange).toHaveBeenCalledWith({ key: 'name', direction: 'desc' });
  expect(screen.getAllByRole('row')[1]).toHaveTextContent('Б');
});
