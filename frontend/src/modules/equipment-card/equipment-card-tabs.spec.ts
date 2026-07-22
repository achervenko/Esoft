import { describe, expect, it } from "vitest";
import { parseEquipmentViewTab } from "./equipment-card-tabs";

describe("parseEquipmentViewTab", () => {
  it.each([
    "details",
    "documents",
    "events",
    "history",
    "maintenance-settings",
  ] as const)("returns %s for supported values", (value) => {
    expect(parseEquipmentViewTab(value)).toBe(value);
  });

  it.each([null, "", "unknown", "DETAILS", "settings"])(
    'returns "details" for %s',
    (value) => {
      expect(parseEquipmentViewTab(value)).toBe("details");
    },
  );
});
