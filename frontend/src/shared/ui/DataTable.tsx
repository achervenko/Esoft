import { Table } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { sortDataTableRows } from './data-table-model';

export type DataTableSortDirection = 'asc' | 'desc';

export type DataTableColumn<Row, SortKey extends string> = {
  key: SortKey;
  label: string;
  render: (row: Row) => ReactNode;
  sortValue?: (row: Row) => number | string;
};

type DataTableProps<Row, SortKey extends string> = {
  columns: Array<DataTableColumn<Row, SortKey>>;
  defaultSort: {
    direction: DataTableSortDirection;
    key: SortKey;
  };
  getRowKey: (row: Row) => string | number;
  onRowDoubleClick?: (row: Row) => void;
  rows: Row[];
};

export function DataTable<Row, SortKey extends string>({
  columns,
  defaultSort,
  getRowKey,
  onRowDoubleClick,
  rows,
}: DataTableProps<Row, SortKey>) {
  const [sort, setSort] = useState(defaultSort);

  const sortedRows = useMemo(
    () => sortDataTableRows(rows, columns, sort),
    [columns, rows, sort],
  );

  const toggleSort = (key: SortKey) => {
    setSort((currentSort) => {
      if (currentSort.key !== key) {
        return { direction: 'asc', key };
      }

      return {
        direction: currentSort.direction === 'asc' ? 'desc' : 'asc',
        key,
      };
    });
  };

  return (
    <Table.Root className="data-table" size="sm" native>
      <thead>
        <tr>
          {columns.map((column) => {
            const isActive = sort.key === column.key;

            return (
              <th key={column.key}>
                <button
                  aria-label={`Сортировать: ${column.label}`}
                  className={`data-table-sort-button${isActive ? ' active' : ''}`}
                  onClick={() => toggleSort(column.key)}
                  type="button"
                >
                  <span>{column.label}</span>
                  {isActive ? (
                    <span
                      aria-hidden="true"
                      className={`data-table-sort-triangle ${sort.direction}`}
                    />
                  ) : null}
                </button>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {sortedRows.map((row) => (
          <tr
            className={onRowDoubleClick ? 'data-table-row-clickable' : undefined}
            key={getRowKey(row)}
            onDoubleClick={() => onRowDoubleClick?.(row)}
          >
            {columns.map((column) => (
              <td key={column.key}>{column.render(row)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </Table.Root>
  );
}
