import type { ReactNode } from "react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { render as testingRender } from "@testing-library/react";
export function render(ui: ReactNode) {
  return testingRender(
    <ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>,
  );
}
