import type { ReactNode } from "react";
import { render as testingRender } from "@testing-library/react";
import { PpeTestProvider } from "./PpeTestProvider";

export function render(ui: ReactNode) {
  return testingRender(ui, { wrapper: PpeTestProvider });
}
