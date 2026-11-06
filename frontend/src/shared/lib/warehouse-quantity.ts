export function formatStockQuantity(value: string) {
  return value.replace(".", ",");
}
export function quantityMillis(value: string): bigint | null {
  if (!/^(0|[1-9]\d{0,10})(\.\d{1,3})?$/.test(value)) return null;
  const [integer, fraction = ""] = value.split(".");
  return BigInt(integer) * 1000n + BigInt(fraction.padEnd(3, "0"));
}
