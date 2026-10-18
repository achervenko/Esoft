import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { NotificationProvider } from "../../shared/ui/notifications";

export function PpeTestProvider({ children }: { children: ReactNode }) {
  return (
    <ChakraProvider value={defaultSystem}>
      <NotificationProvider>{children}</NotificationProvider>
    </ChakraProvider>
  );
}
