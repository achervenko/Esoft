export function formatStockQuantity(value: string) {
  return value.replace(".", ",");
}
export function storagePlacesLabel(count: number) {
  const last = count % 10,
    lastTwo = count % 100;
  return `${count} ${lastTwo >= 11 && lastTwo <= 14 ? "мест хранения" : last === 1 ? "место хранения" : last >= 2 && last <= 4 ? "места хранения" : "мест хранения"}`;
}
export function quantityMillis(value: string): bigint | null {
  if (!/^(0|[1-9]\d{0,10})(\.\d{1,3})?$/.test(value)) return null;
  const [integer, fraction = ""] = value.split(".");
  return BigInt(integer) * 1000n + BigInt(fraction.padEnd(3, "0"));
}
// getRandomValues also works on the HTTP LAN origin used by warehouse phones.
export function transferRequestKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
