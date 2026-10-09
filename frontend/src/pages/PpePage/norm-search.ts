import type { PpePosition } from "../../shared/api/ppe";
export function searchNormPositions(positions: PpePosition[], search: string) {
  const words = search
    .trim()
    .toLocaleLowerCase("ru")
    .replaceAll("ё", "е")
    .split(/\s+/)
    .filter(Boolean);
  return positions.filter((row) =>
    words.every((word) =>
      row.name.toLocaleLowerCase("ru").replaceAll("ё", "е").includes(word),
    ),
  );
}
