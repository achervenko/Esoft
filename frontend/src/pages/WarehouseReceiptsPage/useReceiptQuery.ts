import { useEffect, useRef, useState } from "react";
import { getApiErrorMessage } from "../../shared/api/api-error";
export function useReceiptQuery<T>(
  load: (signal: AbortSignal) => Promise<T>,
  dependencies: readonly unknown[],
) {
  const [state, setState] = useState<{
    data: T | null;
    loading: boolean;
    error: string | null;
  }>({ data: null, loading: true, error: null });
  const previousDependencies = useRef<readonly unknown[] | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    const sameRequest =
      previousDependencies.current?.length === dependencies.length &&
      dependencies.every((value, index) =>
        Object.is(value, previousDependencies.current?.[index]),
      );
    previousDependencies.current = [...dependencies];
    setState((previous) => ({
      data: sameRequest ? previous.data : null,
      loading: true,
      error: null,
    }));
    load(c.signal)
      .then((data) => {
        if (!c.signal.aborted) setState({ data, loading: false, error: null });
      })
      .catch((e) => {
        if (!c.signal.aborted)
          setState((previous) => ({
            data: previous.data,
            loading: false,
            error: getApiErrorMessage(e),
          }));
      });
    return () => c.abort();
    // Callers provide the identity of the request, independently of render closures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, revision]);
  return { ...state, reload: () => setRevision((n) => n + 1) };
}
