import type { EmployeeSizes } from "../../shared/api/ppe";
export const employeeSizeLabels: Record<keyof EmployeeSizes, string> = {
  clothingSize: "Размер одежды",
  clothingHeight: "Ростовка",
  tshirtSize: "Размер футболки",
  tshirtHeight: "Ростовка футболки",
  shoeSize: "Размер обуви",
  gloveSize: "Размер перчаток",
  headwearSize: "Размер головного убора",
};
export function employeeSizesStatus(sizes: EmployeeSizes | null) {
  const fields = Object.keys(employeeSizeLabels) as (keyof EmployeeSizes)[];
  const filled = fields.filter((key) => {
    const value = sizes?.[key];
    return value !== null && value !== undefined && String(value).trim() !== "";
  }).length;
  return filled === 0
    ? "missing"
    : filled === fields.length
      ? "complete"
      : "partial";
}

export function changedEmployeeSizes(
  sizes: EmployeeSizes | null,
  draft: Record<keyof EmployeeSizes, string>,
) {
  const changed: Partial<EmployeeSizes> = {};
  for (const key of Object.keys(
    employeeSizeLabels,
  ) as (keyof EmployeeSizes)[]) {
    const text = draft[key].trim();
    if (key === "shoeSize") {
      const value = text ? Number(text) : null;
      if (value !== (sizes?.shoeSize ?? null)) changed.shoeSize = value;
    } else {
      const value = text || null;
      if (value !== (sizes?.[key] ?? null)) changed[key] = value;
    }
  }
  return changed;
}
