import { formatStockQuantity, quantityMillis } from "./stock-page.utils";

export function stockTransferQuantity(
  quantity: string,
  availableQuantity: string,
  unit: string,
  isReserved: boolean,
) {
  const normalized = quantity.trim().replace(",", ".");
  const amount = quantityMillis(normalized),
    available = quantityMillis(availableQuantity);
  let quantityError: string | undefined;
  if (normalized) {
    if (/^-\d+(\.\d+)?$/.test(normalized))
      quantityError = "Количество не может быть отрицательным.";
    else if (/^\d+\.\d{4,}$/.test(normalized))
      quantityError = "Допустимо не более трёх знаков после запятой.";
    else if (amount === null) quantityError = "Введите корректное количество.";
    else if (amount === 0n)
      quantityError = "Количество должно быть больше нуля.";
    else if (available === null)
      quantityError = "Не удалось определить доступный остаток.";
    else if (amount > available)
      quantityError = `Нельзя переместить больше ${isReserved ? "выбранного резерва" : "доступного остатка"}: ${formatStockQuantity(availableQuantity)} ${unit}.`;
  }
  return { normalized, amount, available, quantityError };
}
