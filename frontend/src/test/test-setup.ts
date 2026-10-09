import "@testing-library/jest-dom/vitest";
Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
  value: () => {},
  writable: true,
});

Object.defineProperty(window, "scrollTo", {
  value: () => {},
  writable: true,
});
