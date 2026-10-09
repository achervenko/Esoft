import { describe, expect, it } from "vitest";
import { normalizePpeSizeText } from "./ppe-size-text";

describe("PPE size range punctuation", () => {
  it.each(["-", "‐", "‑", "‒", "–", "—", "―", "−", "﹘", "﹣", "－"])(
    "normalizes %s while typing",
    (dash) => {
      expect(normalizePpeSizeText(`88 ${dash} 92`)).toBe("88–92");
      expect(normalizePpeSizeText(`170${dash}`)).toBe("170–");
    },
  );
  it("preserves letters, decimal sizes and partially entered values", () => {
    expect(normalizePpeSizeText(" XL ")).toBe(" XL ");
    expect(normalizePpeSizeText("42.5")).toBe("42.5");
    expect(normalizePpeSizeText("")).toBe("");
  });
});
