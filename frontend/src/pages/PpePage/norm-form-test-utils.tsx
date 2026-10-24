import { cleanup, render } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, vi } from "vitest";
import { NormFormModal } from "./NormFormModal";
import { item } from "./ppe-test-fixtures";

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

export function renderNormForm(
  overrides: Partial<ComponentProps<typeof NormFormModal>> = {},
) {
  return render(
    <NormFormModal
      state={{ mode: "create", norm: null }}
      position={{ id: 1, name: "Механик", isActive: true }}
      items={[item]}
      onClose={vi.fn()}
      onChanged={vi.fn()}
      {...overrides}
    />,
  );
}
