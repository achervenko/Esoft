import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { render } from "@testing-library/react";
import type { ComponentProps } from "react";
import { vi } from "vitest";
import { ppeApi } from "../../shared/api/ppe";
import { permissionsForTest } from "../../test/permission-fixtures";
import { NormsPanel } from "./NormsPanel";
import { item, norm } from "./ppe-test-fixtures";

type Props = ComponentProps<typeof NormsPanel>;

export const positions = [
  { id: norm.positionId, name: norm.position, isActive: true },
];

export function prepareNormsPanelTests() {
  vi.spyOn(ppeApi, "employees").mockResolvedValue([]);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
}

export function restoreNormsPanelTests() {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
}

export function normsPanelView(overrides: Partial<Props> = {}) {
  return (
    <ChakraProvider value={defaultSystem}>
      <NormsPanel
        positions={positions}
        items={[item]}
        permissions={permissionsForTest("admin")}
        revision={0}
        onChanged={vi.fn()}
        {...overrides}
      />
    </ChakraProvider>
  );
}

export function renderNormsPanel(overrides: Partial<Props> = {}) {
  return render(normsPanelView(overrides));
}
