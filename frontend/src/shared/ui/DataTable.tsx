import { AppTable } from "./AppTable";
import type { ReactNode, MouseEvent } from "react";
import { useMemo, useState } from "react";
import { useTableRowAnimation } from "./useTableRowAnimation";
import { sortDataTableRows } from "./data-table-model";
import { useProgressiveRows } from "../lib/useProgressiveRows";
import { LoadMore } from "./LoadMore";
import { useWindowedGrid } from "../lib/useWindowedGrid";

export type DataTableSortDirection = "asc" | "desc";

export type DataTableColumn<Row, SortKey extends string> = {
  className?: string;
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
  getRowClassName?: (row: Row) => string | undefined;
  getRowGroup?: (row: Row) => number;
  animateRowMoves?: boolean;
  onRowClick?: (row: Row) => void;
  onRowDoubleClick?: (row: Row) => void;
  onRowContextMenu?: (row: Row, position: { x: number; y: number }) => void;
  rows: Row[];
  selectedRowKey?: string | number | null;
  sort?: { direction: DataTableSortDirection; key: SortKey };
  onSortChange?: (sort: {
    direction: DataTableSortDirection;
    key: SortKey;
  }) => void;
  serverSorted?: boolean;
  incremental?: boolean;
  windowed?: boolean;
};

export function DataTable<Row, SortKey extends string>({
  columns,
  defaultSort,
  getRowKey,
  getRowClassName,
  getRowGroup,
  animateRowMoves = false,
  onRowClick,
  onRowDoubleClick,
  onRowContextMenu,
  rows,
  selectedRowKey,
  sort: controlledSort,
  onSortChange,
  serverSorted = false,
  incremental = !serverSorted,
  windowed = false,
}: DataTableProps<Row, SortKey>) {
  const [localSort, setSort] = useState(defaultSort);
  const sort = controlledSort ?? localSort;

  const sortedRows = useMemo(
    () =>
      serverSorted ? rows : sortDataTableRows(rows, columns, sort, getRowGroup),
    [columns, rows, sort, getRowGroup, serverSorted],
  );

  const visible = useProgressiveRows(
    sortedRows,
    getRowKey,
    `${sort.key}:${sort.direction}`,
  );
  const tableWindow = useWindowedGrid<HTMLTableSectionElement>(
    windowed ? sortedRows.length : 0,
  );
  const displayedRows = windowed
    ? sortedRows.slice(tableWindow.start, tableWindow.end)
    : incremental
      ? visible.rows
      : sortedRows;
  const bodyRef = useTableRowAnimation(
    displayedRows,
    animateRowMoves && !windowed,
  );

  const toggleSort = (key: SortKey) => {
    if (onSortChange) {
      onSortChange({
        key,
        direction:
          sort.key === key && sort.direction === "asc" ? "desc" : "asc",
      });
      return;
    }
    setSort((currentSort) => {
      if (currentSort.key !== key) {
        return { direction: "asc", key };
      }

      return {
        direction: currentSort.direction === "asc" ? "desc" : "asc",
        key,
      };
    });
  };

  return (
    <>
      <AppTable
        incremental={false}
        className={windowed ? "data-table-windowed" : undefined}
      >
        <thead>
          <tr>
            {columns.map((column) => {
              const isActive = sort.key === column.key;
              const isSortable =
                column.isSortable !== false && column.sortValue !== undefined;

              return (
                <th key={column.key} className={column.className}>
                  {isSortable ? (
                    <button
                      aria-label={`Сортировать: ${column.label}`}
                      className={`data-table-sort-button${isActive ? " active" : ""}`}
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
                    <span className="data-table-header-label">
                      {column.label}
                    </span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody ref={windowed ? tableWindow.gridRef : bodyRef}>
          {windowed && tableWindow.before > 0 && (
            <tr aria-hidden="true" className="data-table-spacer">
              <td
                colSpan={columns.length}
                style={{ height: tableWindow.before }}
              />
            </tr>
          )}
          {displayedRows.map((row, index) => (
            <tr
              className={
                [
                  onRowClick || onRowDoubleClick
                    ? "data-table-row-clickable"
                    : null,
                  getRowClassName?.(row),
                ]
                  .filter(Boolean)
                  .join(" ") || undefined
              }
              key={getRowKey(row)}
              data-row-key={getRowKey(row)}
              data-grid-index={windowed ? tableWindow.start + index : undefined}
              aria-rowindex={
                windowed ? tableWindow.start + index + 2 : undefined
              }
              aria-selected={
                selectedRowKey !== undefined
                  ? getRowKey(row) === selectedRowKey
                  : undefined
              }
              onContextMenu={(event: MouseEvent<HTMLTableRowElement>) => {
                if (!onRowContextMenu) return;
                event.preventDefault();
                onRowContextMenu(row, { x: event.clientX, y: event.clientY });
              }}
              onClick={(event) => {
                if (
                  isInteractiveEventTarget(event.target, event.currentTarget)
                ) {
                  return;
                }

                onRowClick?.(row);
              }}
              onDoubleClick={(event) => {
                if (
                  isInteractiveEventTarget(event.target, event.currentTarget)
                ) {
                  return;
                }

                onRowDoubleClick?.(row);
              }}
              onKeyDown={(event) => {
                if (
                  onRowContextMenu &&
                  (event.key === "ContextMenu" ||
                    (event.shiftKey && event.key === "F10"))
                ) {
                  event.preventDefault();
                  const bounds = event.currentTarget.getBoundingClientRect();
                  onRowContextMenu(row, {
                    x: bounds.left + 16,
                    y: bounds.bottom,
                  });
                  return;
                }
                if (
                  event.key !== "Enter" ||
                  isInteractiveEventTarget(event.target, event.currentTarget)
                ) {
                  return;
                }

                event.preventDefault();
                (onRowClick ?? onRowDoubleClick)?.(row);
              }}
              tabIndex={
                onRowClick || onRowDoubleClick || onRowContextMenu
                  ? 0
                  : undefined
              }
            >
              {columns.map((column) => (
                <td key={column.key} className={column.className}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
          {windowed && tableWindow.after > 0 && (
            <tr aria-hidden="true" className="data-table-spacer">
              <td
                colSpan={columns.length}
                style={{ height: tableWindow.after }}
              />
            </tr>
          )}
        </tbody>
      </AppTable>
      {incremental && !windowed && sortedRows.length > 100 && (
        <LoadMore
          shown={visible.rows.length}
          total={sortedRows.length}
          hasMore={visible.hasMore}
          loading={false}
          error={null}
          onLoadMore={visible.loadMore}
          onRetry={visible.loadMore}
        />
      )}
    </>
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
      "a",
      "button",
      "input",
      "select",
      "textarea",
      "summary",
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
    ].join(","),
  );

  return Boolean(interactiveElement && interactiveElement !== rowElement);
}
