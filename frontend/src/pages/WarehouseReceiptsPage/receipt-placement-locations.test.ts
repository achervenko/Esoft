import { expect, it } from "vitest";
import { groupReceiptPlacements } from "./receipt-placement-locations";
const placement = (
  id: string,
  storageLocationId: string,
  quantity: string,
  name = "А-02",
) => ({
  id,
  storageLocationId,
  quantity,
  location: { name },
  createdAt: "2026-11-02T00:00:00Z",
});
it("sums batches at the same location using exact decimal arithmetic", () => {
  const input = [placement("1", "505", "6"), placement("2", "505", "0.5")];
  expect(groupReceiptPlacements(input)).toEqual([
    { storageLocationId: "505", location: { name: "А-02" }, quantity: "6.5" },
  ]);
  expect(input).toHaveLength(2);
  expect(input[0].quantity).toBe("6");
});
it("keeps different location IDs separate even if names match, and uses IDs after renaming", () => {
  expect(
    groupReceiptPlacements([
      placement("1", "1", "0.1"),
      placement("2", "1", "0.2", "Новое имя"),
      placement("3", "2", "0.001"),
    ]).map((p) => [p.storageLocationId, p.quantity]),
  ).toEqual([
    ["1", "0.3"],
    ["2", "0.001"],
  ]);
});
it("preserves thousandths and quantities beyond safe integer arithmetic in millis", () => {
  expect(
    groupReceiptPlacements([
      placement("1", "1", "99999999999.998"),
      placement("2", "1", "0.001"),
    ])[0].quantity,
  ).toBe("99999999999.999");
});
