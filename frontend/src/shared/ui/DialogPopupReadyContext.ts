import { createContext } from "react";

// Portals retain React context even when their DOM is outside the dialog.
export const DialogPopupReadyContext = createContext(true);
