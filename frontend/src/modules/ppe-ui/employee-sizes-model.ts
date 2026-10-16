import type { EmployeeSizes } from "../../shared/api/ppe";
export const employeeSizeLabels: Record<keyof EmployeeSizes, string> = {
  clothingSize: "Размер одежды",
  clothingHeight: "Ростовка",
  shoeSize: "Размер обуви",
  gloveSize: "Размер перчаток",
  headwearSize: "Размер головного убора",
};
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
