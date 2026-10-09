import { useCallback, useContext } from "react";
import {
  ConfirmationContext,
  type RequestConfirmation,
} from "./confirmation-context";
export type { RequestConfirmation } from "./confirmation-context";
export function useConfirmation(): RequestConfirmation {
  const confirm = useContext(ConfirmationContext);
  return useCallback(
    (request) => {
      if (!confirm)
        throw new Error(
          "ConfirmationProvider is required for confirmation actions.",
        );
      return confirm(request);
    },
    [confirm],
  );
}
