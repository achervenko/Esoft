import { describe, expect, it } from "vitest";
import { formatPpeQuantity } from "../../modules/ppe-ui/ppe-presentation";

describe("PPE quantity units", () => {
  it.each([
    [1, "1 пара"],
    [2, "2 пары"],
    [5, "5 пар"],
    [11, "11 пар"],
    [21, "21 пара"],
    [120, "120 пар"],
    [2.5, "2,5 пары"],
  ])("formats %s pairs", (quantity, expected) => {
    expect(formatPpeQuantity(Number(quantity), "пары")).toBe(expected);
  });
  it("keeps abbreviations", () => {
    expect(formatPpeQuantity(120, "мл")).toBe("120 мл");
    expect(formatPpeQuantity(2, "шт")).toBe("2 шт");
  });
});
