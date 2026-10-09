import { createContext } from "react";
export type ConfirmationRequest = {
  description: string;
  title?: string;
  confirmLabel?: string;
  variant?: "default" | "danger";
};
export type RequestConfirmation = (
  request: ConfirmationRequest,
) => Promise<boolean>;
export const ConfirmationContext = createContext<RequestConfirmation | null>(
  null,
);
