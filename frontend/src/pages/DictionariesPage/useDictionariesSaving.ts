import { useRef, useState } from "react";
import { getDictionariesAdminErrorMessage } from "./dictionaries-admin-error-messages";

type UseDictionariesSavingParams = {
  notifyError: (title: string, message?: string) => void;
  setError: (message: string | null) => void;
  setMessage: (message: string | null) => void;
};

export function useDictionariesSaving({
  notifyError,
  setError,
  setMessage,
}: UseDictionariesSavingParams) {
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  const runSavingAction = async (action: () => Promise<void>) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      await action();
    } catch (requestError) {
      const message = getDictionariesAdminErrorMessage(requestError);
      setError(message);
      notifyError("Операция не выполнена", message);
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  return {
    isSaving,
    runSavingAction,
  };
}
