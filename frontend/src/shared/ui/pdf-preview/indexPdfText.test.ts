import { expect, it, vi } from "vitest";
import { indexPdfText } from "./indexPdfText";

it("indexes a large document with at most two concurrent page requests in page order", async () => {
  let active = 0;
  let peak = 0;
  const getPage = vi.fn(async (number: number) => {
    active += 1;
    peak = Math.max(peak, active);
    return { getTextContent: async () => {
      await new Promise((resolve) => setTimeout(resolve, number % 3));
      active -= 1;
      return { items: [{ str: `Page ${number}` }] };
    } };
  });
  const result = await indexPdfText({ numPages: 100, getPage }, () => true);
  expect(peak).toBe(2);
  expect(getPage).toHaveBeenCalledTimes(100);
  expect(result).toEqual(Array.from({ length: 100 }, (_, index) => [`Page ${index + 1}`]));
});

it("stops scheduling work when the document is closed", async () => {
  let current = true;
  const getTextContent = vi.fn(async () => ({ items: [] }));
  const getPage = vi.fn(async () => {
    current = false;
    return { getTextContent };
  });
  expect(await indexPdfText({ numPages: 1000, getPage }, () => current)).toBeNull();
  expect(getPage).toHaveBeenCalledTimes(1);
  expect(getTextContent).not.toHaveBeenCalled();
});

it("does not schedule remaining pages after extraction fails", async () => {
  const getPage = vi.fn(async () => {
    throw new Error("Broken page");
  });
  await expect(indexPdfText({ numPages: 1000, getPage }, () => true)).rejects.toThrow("Broken page");
  await new Promise((resolve) => setTimeout(resolve, 5));
  expect(getPage).toHaveBeenCalledTimes(2);
});
