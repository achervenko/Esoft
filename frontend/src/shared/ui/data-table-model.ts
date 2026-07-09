import type { DataTableColumn, DataTableSortDirection } from './DataTable';

export function sortDataTableRows<Row, SortKey extends string>(
  rows: Row[],
  columns: Array<DataTableColumn<Row, SortKey>>,
  sort: {
    direction: DataTableSortDirection;
    key: SortKey;
  },
) {
  const column = columns.find((currentColumn) => currentColumn.key === sort.key);
  const directionMultiplier = sort.direction === 'asc' ? 1 : -1;

  if (!column?.sortValue) {
    return rows;
  }

  return [...rows].sort((firstRow, secondRow) => {
    const firstValue = column.sortValue?.(firstRow) ?? '';
    const secondValue = column.sortValue?.(secondRow) ?? '';

    if (typeof firstValue === 'number' && typeof secondValue === 'number') {
      return (firstValue - secondValue) * directionMultiplier;
    }

    return (
      String(firstValue).localeCompare(String(secondValue), 'ru', {
        numeric: true,
        sensitivity: 'base',
      }) * directionMultiplier
    );
  });
}
