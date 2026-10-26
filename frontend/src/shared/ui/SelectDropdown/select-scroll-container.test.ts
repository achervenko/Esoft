import { afterEach, expect, it } from "vitest";
import { getSelectScrollContainer } from "./select-scroll-container";

afterEach(() => document.body.replaceChildren());

it("finds the nearest scrolling panel without relying on application class names", () => {
  const outer = document.createElement("section");
  const inner = document.createElement("div");
  const input = document.createElement("input");
  outer.style.overflowY = "auto";
  inner.style.overflowY = "scroll";
  inner.append(input);
  outer.append(inner);
  document.body.append(outer);
  expect(getSelectScrollContainer(input)).toBe(inner);
  inner.style.overflowY = "visible";
  expect(getSelectScrollContainer(input)).toBe(outer);
  outer.style.overflowY = "visible";
  expect(getSelectScrollContainer(input)).toBeNull();
});
