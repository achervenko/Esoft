import { useRef, useState } from "react";
import { ApiRequestError } from "../../shared/api/api-error";
import { createRequestKey } from "../../shared/lib/request-key";

type Pending<T> = { requestKey: string; body: T };
const pendingKey = (actorId: string | null, operation: string) =>
  `warehouse.receipts.pending:${actorId}:${operation}`;

export function hasPendingReceiptSubmission(
  actorId: string | null,
  operation: string,
) {
  if (!actorId) return false;
  try {
    return sessionStorage.getItem(pendingKey(actorId, operation)) !== null;
  } catch {
    return false;
  }
}

// Persist before sending: a lost response must survive closing the dialog or reloading.
export function useReceiptSubmission<T>(
  actorId: string | null,
  operation: string,
) {
  const storageKey = pendingKey(actorId, operation);
  const [initial] = useState<{ pending: Pending<T> | null; error: boolean }>(
    () => {
      if (!actorId) return { pending: null, error: false };
      try {
        const stored = sessionStorage.getItem(storageKey);
        const value = stored ? JSON.parse(stored) : null;
        if (
          stored !== null &&
          (!value ||
            typeof value.requestKey !== "string" ||
            !value.body ||
            typeof value.body !== "object")
        )
          throw new Error("Invalid pending receipt");
        return { pending: value, error: false };
      } catch {
        return { pending: null, error: true };
      }
    },
  );
  const [pending, setPending] = useState(initial.pending);
  const current = useRef(pending);
  return {
    pending,
    async submit<R>(
      body: T,
      send: (value: T & { requestKey: string }) => Promise<R>,
    ) {
      if (!actorId)
        throw new Error(
          "Не удалось определить пользователя. Обновите страницу.",
        );
      if (initial.error)
        throw new Error(
          "Не удалось прочитать предыдущую отправку. Проверьте документ с администратором перед повтором.",
        );
      const retry = current.current !== null;
      const attempt = current.current ?? {
        body,
        requestKey: createRequestKey(),
      };
      // If storage is unavailable, do not start an operation we cannot safely retry.
      sessionStorage.setItem(storageKey, JSON.stringify(attempt));
      current.current = attempt;
      setPending(attempt);
      let result: R;
      try {
        result = await send({
          ...attempt.body,
          requestKey: attempt.requestKey,
        });
      } catch (error) {
        // A first definitive rejection cannot have committed. After an uncertain
        // response, even a permission error cannot prove the original outcome.
        if (
          !retry &&
          error instanceof ApiRequestError &&
          error.status >= 400 &&
          error.status < 500 &&
          error.status !== 408
        ) {
          sessionStorage.removeItem(storageKey);
          current.current = null;
          setPending(null);
        }
        throw error;
      }
      sessionStorage.removeItem(storageKey);
      current.current = null;
      setPending(null);
      return result;
    },
  };
}
