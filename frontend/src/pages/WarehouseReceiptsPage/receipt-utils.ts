import type { ReceiptStatus } from "../../shared/api/warehouse-receipts-api";
import { quantityMillis } from "../../shared/lib/warehouse-quantity";
export const receiptStatus: Record<ReceiptStatus, string> = {
  RECEIVED: "Ожидает размещения",
  PLACING: "Частично размещён",
  PLACED: "Размещён",
  CANCELLED: "Отменён",
};
export function quantityMilli(value: string): bigint | null {
  return quantityMillis(value.replace(",", "."));
}
export function quantityError(value: string, max?: string): string | null {
  if (value.startsWith("-")) return "Количество не может быть отрицательным.";
  const n = quantityMilli(value);
  if (n === null) return "Введите число, до трёх знаков после запятой.";
  if (n === 0n) return "Количество должно быть больше нуля.";
  if (max !== undefined && n > (quantityMilli(max) ?? 0n))
    return `Нельзя больше оставшегося количества: ${max}.`;
  return null;
}

// Receipt sums may exceed the quantity limit of one individual line.
export function receiptQuantityPercent(placed: string, total: string) {
  const millis = (value: string) => {
    const [whole, fraction = ""] = value.split(".");
    return BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, "0"));
  };
  const denominator = millis(total);
  if (!denominator) return 0;
  const tenths = (millis(placed) * 1000n) / denominator;
  return Number(tenths > 1000n ? 1000n : tenths) / 10;
}
