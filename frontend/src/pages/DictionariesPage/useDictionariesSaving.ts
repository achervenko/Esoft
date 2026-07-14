import { useState } from "react";
import { getDictionariesAdminErrorMessage } from "./dictionaries-admin-error-messages";

type UseDictionariesSavingParams = {
  setError: (message: string | null) => void;
  setMessage: (message: string | null) => void;
};

export function useDictionariesSaving({
  setError,
  setMessage,
}: UseDictionariesSavingParams) {
  const [isSaving, setIsSaving] = useState(false);

  const runSavingAction = async (action: () => Promise<void>) => {
    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      await action();
    } catch (requestError) {
      setError(getDictionariesAdminErrorMessage(requestError));
    } finally {
      setIsSaving(false);
    }
  };

  return {
    isSaving,
    runSavingAction,
  };
}
