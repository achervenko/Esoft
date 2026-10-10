import { NotificationProvider } from "../../shared/ui/notifications";
import type { ReactNode } from "react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { render as testingRender } from "@testing-library/react";
function Wrapper({ children }: { children: ReactNode }) {
  return <ChakraProvider value={defaultSystem}><NotificationProvider>{children}</NotificationProvider></ChakraProvider>;
}
export function render(ui: ReactNode) {
  return testingRender(ui, { wrapper: Wrapper });
}
