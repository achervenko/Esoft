import { Table } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { sortDataTableRows } from './data-table-model';

export type DataTableSortDirection = 'asc' | 'desc';

export type DataTableColumn<Row, SortKey extends string> = {
  isSortable?: boolean;
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
  onRowClick?: (row: Row) => void;
  onRowDoubleClick?: (row: Row) => void;
  rows: Row[];
};

export function DataTable<Row, SortKey extends string>({
  columns,
  defaultSort,
  getRowKey,
  onRowClick,
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
            const isSortable = column.isSortable !== false;

            return (
              <th key={column.key}>
                {isSortable ? (
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
                ) : (
                  <span className="data-table-header-label">{column.label}</span>
                )}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {sortedRows.map((row) => (
          <tr
            className={
              onRowClick || onRowDoubleClick ? 'data-table-row-clickable' : undefined
            }
            key={getRowKey(row)}
            onClick={(event) => {
              if (isInteractiveEventTarget(event.target, event.currentTarget)) {
                return;
              }

              onRowClick?.(row);
            }}
            onDoubleClick={(event) => {
              if (isInteractiveEventTarget(event.target, event.currentTarget)) {
                return;
              }

              onRowDoubleClick?.(row);
            }}
            onKeyDown={(event) => {
              if (
                event.key !== 'Enter' ||
                isInteractiveEventTarget(event.target, event.currentTarget)
              ) {
                return;
              }

              event.preventDefault();
              (onRowClick ?? onRowDoubleClick)?.(row);
            }}
            tabIndex={onRowClick || onRowDoubleClick ? 0 : undefined}
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

function isInteractiveEventTarget(
  target: EventTarget | null,
  rowElement: HTMLElement,
) {
  if (!(target instanceof Element) || target === rowElement) {
    return false;
  }

  const interactiveElement = target.closest(
    [
      'a',
      'button',
      'input',
      'select',
      'textarea',
      'summary',
      '[contenteditable="true"]',
      '[role="button"]',
      '[role="checkbox"]',
      '[role="combobox"]',
      '[role="link"]',
      '[role="menuitem"]',
      '[role="option"]',
      '[role="radio"]',
      '[role="switch"]',
      '[tabindex]:not([tabindex="-1"])',
    ].join(','),
  );

  return Boolean(interactiveElement && interactiveElement !== rowElement);
}
