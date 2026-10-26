import { useMemo, useRef, useState } from "react";

/** For APIs that already return the complete list; sorting/filtering happen before slicing. */
export function useProgressiveRows<T>(
  rows: readonly T[],
  getKey: (row: T, index: number) => string | number,
  resetKey = "",
) {
  const key = JSON.stringify([resetKey, rows.map(getKey)]);
  const token = useMemo(() => Symbol(key), [key]);
  const [window, setWindow] = useState({ token, limit: 100 });
  const claim = useRef<{ token: symbol; limit: number } | null>(null);
  const currentToken = useRef(token);
  currentToken.current = token;
  const limit = window.token === token ? window.limit : 100;
  return {
    rows: rows.slice(0, limit),
    hasMore: rows.length > limit,
    loadMore: () => {
      if (
        currentToken.current !== token ||
        limit >= rows.length ||
        (claim.current?.token === token && claim.current.limit > limit)
      )
        return;
      claim.current = { token, limit: limit + 100 };
      setWindow(claim.current);
    },
  };
}
