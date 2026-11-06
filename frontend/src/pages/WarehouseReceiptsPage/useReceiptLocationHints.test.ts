import { expect, it } from "vitest";
import { placementLocationOptions } from "./useReceiptLocationHints";
import type { StockDistribution } from "../../shared/api/warehouse-stock-api";
it("ranks exact item balances before empty locations, with numeric alphabetical ties", () => {
  const locations = [
    { id: "1", name: "А-10" },
    { id: "2", name: "Б-01" },
    { id: "3", name: "А-02" },
    { id: "4", name: "А-01" },
  ];
  const balances = [
    { location: { id: "2" }, quantity: "6.5" },
    { location: { id: "1" }, quantity: "0.001" },
    { location: { id: "3" }, quantity: "0.001" },
    { location: { id: "999" }, quantity: "100" },
  ] as StockDistribution["locations"];
  expect(placementLocationOptions(locations, balances, "м")).toEqual([
    { value: "2", label: "Б-01", quantityLabel: "6,5 м" },
    { value: "3", label: "А-02", quantityLabel: "0,001 м" },
    { value: "1", label: "А-10", quantityLabel: "0,001 м" },
    { value: "4", label: "А-01", quantityLabel: "" },
  ]);
});
