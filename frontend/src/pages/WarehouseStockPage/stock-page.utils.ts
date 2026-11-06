export {
  formatStockQuantity,
  quantityMillis,
} from "../../shared/lib/warehouse-quantity";
export { createRequestKey as transferRequestKey } from "../../shared/lib/request-key";
export function storagePlacesLabel(count: number) {
  const last = count % 10,
    lastTwo = count % 100;
  return `${count} ${lastTwo >= 11 && lastTwo <= 14 ? "мест хранения" : last === 1 ? "место хранения" : last >= 2 && last <= 4 ? "места хранения" : "мест хранения"}`;
}
