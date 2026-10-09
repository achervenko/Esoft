import { useState } from "react";
/** Capture the form's initialized data, not changes to loading/error/UI state. */
export function useDraftChanges(value: unknown) {
  const [initial] = useState(() => JSON.stringify(value));
  return JSON.stringify(value) !== initial;
}
