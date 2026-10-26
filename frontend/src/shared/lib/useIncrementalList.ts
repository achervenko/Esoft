import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getApiErrorMessage } from "../api/api-error";

type Page<T> = { items: T[]; total: number; limit: number };
type State<T, Meta extends object> = {
  token: symbol;
  data: (Page<T> & Meta) | null;
  nextOffset: number;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
};

/** Offset pages accumulate within one query; errors retain the successful pages. */
export function useIncrementalList<
  T,
  Meta extends object = Record<never, never>,
>({
  queryKey,
  enabled,
  loadPage,
  getKey,
}: {
  queryKey: string;
  enabled: boolean;
  loadPage: (offset: number, signal: AbortSignal) => Promise<Page<T> & Meta>;
  getKey: (item: T) => string | number;
}) {
  const token = useMemo(
    () => Symbol(enabled ? queryKey : "disabled"),
    [queryKey, enabled],
  );
  const currentToken = useRef(token);
  currentToken.current = token;
  const loader = useRef(loadPage);
  loader.current = loadPage;
  const keyOf = useRef(getKey);
  keyOf.current = getKey;
  const pending = useRef<AbortController | null>(null);
  const progress = useRef<{ token: symbol; nextOffset: number } | null>(null);
  const [state, setState] = useState<State<T, Meta> | null>(null);

  const request = useCallback(
    async (offset: number) => {
      if (
        !enabled ||
        currentToken.current !== token ||
        pending.current ||
        (progress.current?.token === token &&
          offset < progress.current.nextOffset)
      )
        return;
      const controller = new AbortController();
      pending.current = controller;
      setState((previous) => ({
        token,
        data: previous?.token === token ? previous.data : null,
        nextOffset: offset,
        hasMore: previous?.token === token && previous.hasMore,
        loading: true,
        error: null,
      }));
      try {
        const result = await loader.current(offset, controller.signal);
        if (controller.signal.aborted || currentToken.current !== token) return;
        progress.current = { token, nextOffset: offset + result.limit };
        setState((previous) => {
          const items = new Map<string | number, T>();
          if (offset > 0 && previous?.token === token)
            previous.data?.items.forEach((item) =>
              items.set(keyOf.current(item), item),
            );
          result.items.forEach((item) => items.set(keyOf.current(item), item));
          const nextOffset = offset + result.limit;
          return {
            token,
            data: { ...result, items: [...items.values()] },
            nextOffset,
            hasMore: result.items.length > 0 && nextOffset < result.total,
            loading: false,
            error: null,
          };
        });
      } catch (error) {
        if (!controller.signal.aborted && currentToken.current === token)
          setState((previous) =>
            previous?.token === token
              ? {
                  ...previous,
                  loading: false,
                  error: getApiErrorMessage(error),
                }
              : previous,
          );
      } finally {
        if (pending.current === controller) pending.current = null;
      }
    },
    [enabled, token],
  );

  useEffect(() => {
    if (enabled) void request(0);
    return () => {
      pending.current?.abort();
      pending.current = null;
    };
  }, [enabled, request]);

  const current = state?.token === token ? state : null;
  return {
    data: enabled ? (current?.data ?? null) : null,
    loading: enabled && (!current || current.loading),
    error: enabled ? (current?.error ?? null) : null,
    hasMore: enabled && !!current?.hasMore,
    loadMore: () => {
      if (current && !current.loading && !current.error && current.hasMore)
        void request(current.nextOffset);
    },
    retry: () => {
      if (current?.error) void request(current.nextOffset);
    },
  };
}
