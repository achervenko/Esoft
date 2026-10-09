import {
  ConfirmationContext,
  type ConfirmationRequest,
  type RequestConfirmation,
} from "./confirmation-context";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ConfirmDialog } from "./ConfirmDialog";

export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmationRequest | null>(null);
  const pending = useRef<((answer: boolean) => void) | null>(null);
  const settle = useCallback((answer: boolean) => {
    const resolve = pending.current;
    pending.current = null;
    setRequest(null);
    resolve?.(answer);
  }, []);
  const confirm = useCallback<RequestConfirmation>((next) => {
    if (pending.current) return Promise.resolve(false);
    return new Promise((resolve) => {
      pending.current = resolve;
      setRequest(next);
    });
  }, []);
  useEffect(() => {
    const cancel = () => settle(false);
    window.addEventListener("hashchange", cancel);
    return () => {
      window.removeEventListener("hashchange", cancel);
      pending.current?.(false);
      pending.current = null;
    };
  }, [settle]);
  return (
    <ConfirmationContext.Provider value={confirm}>
      {children}
      {request && (
        <ConfirmDialog
          title={request.title ?? "Подтвердить действие?"}
          description={request.description}
          confirmLabel={request.confirmLabel ?? "Подтвердить"}
          cancelLabel="Назад"
          variant={request.variant ?? "default"}
          onConfirm={() => settle(true)}
          onCancel={() => settle(false)}
        />
      )}
    </ConfirmationContext.Provider>
  );
}
