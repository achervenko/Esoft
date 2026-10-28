import { it, expect } from "vitest";
import {
  quantityMillis,
  storagePlacesLabel,
  transferRequestKey,
} from "./stock-page.utils";
it("keeps decimal quantities exact and validates precision", () => {
  expect(quantityMillis("99999999999.999")).toBe(99999999999999n);
  expect(quantityMillis("1.001")).toBe(1001n);
  for (const value of ["1e3", "-1", "1.0001", "01", "NaN", "100000000000"])
    expect(quantityMillis(value)).toBeNull();
});
it("declines place counts and generates a v4 key without secure-context randomUUID", () => {
  expect(storagePlacesLabel(21)).toBe("21 место хранения");
  expect(storagePlacesLabel(12)).toBe("12 мест хранения");
  expect(storagePlacesLabel(22)).toBe("22 места хранения");
  expect(transferRequestKey()).toMatch(
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
  );
});
