import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { render as baseRender } from "@testing-library/react";
import type { ReactElement } from "react";
export function render(ui: ReactElement) {
  return baseRender(ui, {
    wrapper: ({ children }) => (
      <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
    ),
  });
}
