import { useEffect, useRef, useState } from "react";
import { ppeError } from "./ppe-presentation";

export function usePpeQuery<T>(
  key: string,
  load: (signal: AbortSignal) => Promise<T>,
  enabled = true,
) {
  const loader = useRef(load);
  loader.current = load;
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{
    key: string;
    data: T | null;
    error: string | null;
    loading: boolean;
  }>({ key, data: null, error: null, loading: enabled });
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setState((current) => ({
      key,
      data: current.key === key ? current.data : null,
      error: null,
      loading: true,
    }));
    void loader
      .current(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted)
          setState({ key, data, error: null, loading: false });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState((current) => ({
            key,
            data: current.key === key ? current.data : null,
            error: ppeError(error),
            loading: false,
          }));
      });
    return () => controller.abort();
  }, [key, retry, enabled]);
  return {
    data: enabled && state.key === key ? state.data : null,
    error: enabled && state.key === key ? state.error : null,
    loading: enabled && (state.key !== key || state.loading),
    reload: () => setRetry((value) => value + 1),
  };
}
