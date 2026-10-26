export type GridLayout = {
  columns: number;
  gap: number;
  estimatedHeight: number;
  rowHeights: Record<number, number>;
  scrollTop: number;
  viewportHeight: number;
};

/** Keep at most 100 preceding and 50 following items, rounded to complete rows. */
export function getGridWindow(count: number, layout: GridLayout) {
  const {
    columns,
    gap,
    estimatedHeight,
    rowHeights,
    scrollTop,
    viewportHeight,
  } = layout;
  const rows = Math.ceil(count / columns);
  const offsets = [0];
  for (let row = 0; row < rows; row++)
    offsets.push(offsets[row] + (rowHeights[row] ?? estimatedHeight) + gap);
  const totalHeight = Math.max(0, offsets[rows] - gap);
  let first = 0;
  while (first + 1 < rows && offsets[first + 1] <= scrollTop) first++;
  let last = first;
  while (last < rows && offsets[last] < scrollTop + viewportHeight) last++;
  const startRow = Math.max(0, first - Math.floor(100 / columns));
  const endRow = Math.min(
    rows,
    Math.max(first + 1, last) + Math.floor(50 / columns),
  );
  return {
    start: startRow * columns,
    end: Math.min(count, endRow * columns),
    before: startRow ? Math.max(0, offsets[startRow] - gap) : 0,
    after: endRow < rows ? Math.max(0, totalHeight - offsets[endRow]) : 0,
  };
}
