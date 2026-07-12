export function normalizeSearchText(
  values: Array<number | string | null | undefined>,
) {
  return values
    .filter((value): value is number | string => value !== null && value !== undefined)
    .map((value) => String(value))
    .join(' ')
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeSearchQuery(value: unknown) {
  return normalizeSearchText([typeof value === 'string' ? value : '']);
}

export function removeInventorySeparators(value: string | null | undefined) {
  return value?.replace(/[\s-]+/g, '') ?? '';
}
