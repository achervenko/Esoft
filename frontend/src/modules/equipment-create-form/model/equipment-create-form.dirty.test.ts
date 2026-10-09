import { describe, expect, it } from "vitest";
import { isEquipmentCreateFormDirty } from "./equipment-create-form.dirty";
import { initialEquipmentCreateFormState } from "./equipment-create-form.types";

describe("equipment create dirty state", () => {
  it("ignores generated ID and additional server metadata", () => {
    const form = {
      ...initialEquipmentCreateFormState,
      visibleId: "123",
      serverMetadata: "loaded",
    };
    expect(isEquipmentCreateFormDirty(form)).toBe(false);
  });
  it("detects user edits and becomes clean after restoring values", () => {
    const form = { ...initialEquipmentCreateFormState, name: "Станок" };
    expect(isEquipmentCreateFormDirty(form)).toBe(true);
    form.name = "";
    expect(isEquipmentCreateFormDirty(form)).toBe(false);
  });
  it("compares against supplied defaults without hiding user edits", () => {
    const baseline = {
      ...initialEquipmentCreateFormState,
      status: "ACTIVE",
      countryId: 1,
    };
    expect(isEquipmentCreateFormDirty({ ...baseline }, baseline)).toBe(false);
    expect(
      isEquipmentCreateFormDirty({ ...baseline, countryId: 2 }, baseline),
    ).toBe(true);
  });
});
