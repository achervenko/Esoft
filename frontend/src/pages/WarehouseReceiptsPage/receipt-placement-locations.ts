import type { ReceiptLine } from "../../shared/api/warehouse-receipts-api";
import { quantityMillis } from "../../shared/lib/warehouse-quantity";

export function groupReceiptPlacements(placements: ReceiptLine["placements"]) {
  const locations = new Map<
    string,
    {
      storageLocationId: string;
      location: ReceiptLine["placements"][number]["location"];
      millis: bigint;
    }
  >();
  for (const entry of placements) {
    const millis = quantityMillis(entry.quantity);
    if (millis === null) throw new Error("Некорректное количество размещения.");
    const current = locations.get(entry.storageLocationId);
    if (current) current.millis += millis;
    else
      locations.set(entry.storageLocationId, {
        storageLocationId: entry.storageLocationId,
        location: entry.location,
        millis,
      });
  }
  return Array.from(locations.values(), ({ millis, ...entry }) => {
    const fraction = String(millis % 1000n)
      .padStart(3, "0")
      .replace(/0+$/, "");
    return {
      ...entry,
      quantity: `${millis / 1000n}${fraction ? `.${fraction}` : ""}`,
    };
  });
}
