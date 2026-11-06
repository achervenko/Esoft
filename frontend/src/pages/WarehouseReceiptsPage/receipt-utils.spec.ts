import { describe, expect, it } from "vitest";
import {
  quantityError,
  quantityMilli,
  receiptQuantityPercent,
} from "./receipt-utils";
describe("receipt quantities", () => {
  it.each([
    ["1", 1000n],
    ["1,025", 1025n],
    ["99999999999.999", 99999999999999n],
  ])("parses %s without floating-point rounding", (value, expected) =>
    expect(quantityMilli(value)).toBe(expected),
  );
  it.each(["1e3", "1.0001", "100000000000", "NaN", ""])(
    "rejects invalid quantity %s",
    (value) => expect(quantityMilli(value)).toBeNull(),
  );
  it("distinguishes negative, zero and exceeding amounts", () => {
    expect(quantityError("-1")).toContain("отрицательным");
    expect(quantityError("0")).toContain("больше нуля");
    expect(quantityError("2.001", "2")).toContain("Нельзя больше");
    expect(quantityError("2", "2")).toBeNull();
  });
});

it.each([
  ["2", "50", 4],
  ["1.125", "2.5", 45],
  ["0", "0", 0],
  ["9999999999999.899", "9999999999999.900", 99.9],
  ["50", "50", 100],
])("quantity progress %s / %s is %s percent", (placed, total, expected) => {
  expect(receiptQuantityPercent(placed, total)).toBe(expected);
});
