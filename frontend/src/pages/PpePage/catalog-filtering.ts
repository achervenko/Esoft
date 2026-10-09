import type { PpeItem } from "../../shared/api/ppe";

export type CatalogFilters = {
  type: string;
  status: string;
  size: string;
  height: string;
  inNorm: string;
};
export const emptyCatalogFilters: CatalogFilters = {
  type: "",
  status: "",
  size: "",
  height: "",
  inNorm: "",
};

const normalizeSize = (value: string) =>
  value.trim().toLocaleLowerCase("ru").replaceAll("ё", "е");

export function getCatalogHeightOptions(items: PpeItem[]) {
  return [
    ...new Set(
      items.flatMap((item) =>
        item.sizes
          .filter((size) => size.isActive)
          .flatMap((size) => (size.heightValue ? [size.heightValue] : [])),
      ),
    ),
  ].sort();
}

export function filterCatalogItems(
  items: PpeItem[],
  search: string,
  { type, status, size, height, inNorm }: CatalogFilters,
) {
  return items.filter(
    (item) =>
      `${item.article} ${item.name}`
        .toLocaleLowerCase("ru")
        .includes(search.toLocaleLowerCase("ru")) &&
      (!type || item.type === type) &&
      (!status || String(item.isActive) === status) &&
      (!inNorm || String(Boolean(item.hasActiveNorm)) === inNorm) &&
      ((!size && !height) ||
        item.sizes.some(
          (row) =>
            row.isActive &&
            (!size || normalizeSize(row.value) === normalizeSize(size)) &&
            (!height ||
              normalizeSize(row.heightValue ?? "") === normalizeSize(height)),
        )),
  );
}
