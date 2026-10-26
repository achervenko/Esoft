import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { searchApp, type SearchResultItem } from "../../shared/api/search-api";
const SEARCH_LIMIT = 20;
const SEARCH_MAX_OFFSET = 1000;
const MIN_QUERY_LENGTH = 2;

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ");
}

function resultKey(item: SearchResultItem) {
  return `${item.entityType}:${item.entityId}`;
}

function reuseResults(
  previous: SearchResultItem[],
  incoming: SearchResultItem[],
) {
  const byId = new Map(previous.map((item) => [resultKey(item), item]));
  const next = incoming.map((item) => {
    const old = byId.get(resultKey(item));
    if (!old) return item;
    const { score: oldScore, ...oldData } = old;
    const { score: newScore, ...newData } = item;
    void oldScore;
    void newScore;
    return JSON.stringify(oldData) === JSON.stringify(newData) ? old : item;
  });
  return previous.length === next.length &&
    previous.every((item, index) => item === next[index])
    ? previous
    : next;
}

export function useSearchPageQuery({
  query,
  module,
  userPermissions,
}: {
  query: string;
  module: string;
  userPermissions: readonly string[] | null;
}) {
  const moduleRef = useRef(module);
  const permissionsRef = useRef(userPermissions);
  const snapshot = useRef<{ items: SearchResultItem[] }>({
    items: [],
  });
  const generation = useRef(0);
  const settledGeneration = useRef<number | null>(null);
  const requestedPage = useRef<{ generation: number; offset: number } | null>(
    null,
  );
  const sentinel = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [initialRetry, setInitialRetry] = useState(0);
  const [pageRetry, setPageRetry] = useState(0);
  const failedPage = useRef<"initial" | "next">("initial");
  const [limitReached, setLimitReached] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [settledQuery, setSettledQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedQuery = useMemo(() => normalize(query), [query]);
  const isQueryReady = normalizedQuery.length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    if (
      moduleRef.current !== module ||
      permissionsRef.current !== userPermissions
    ) {
      permissionsRef.current = userPermissions;
      moduleRef.current = module;
      snapshot.current = { items: [] };
      setResults([]);
    }
    const requestGeneration = ++generation.current;
    settledGeneration.current = null;
    setSettledQuery("");
    const controller = new AbortController();
    setOffset(0);
    setLimitReached(false);
    setHasMore(false);
    setError(null);
    if (!isQueryReady) {
      setResults([]);
      setIsLoading(false);
      setSettledQuery("");
      snapshot.current = { items: [] };
      return;
    }
    // Keep the last response until the server resolves fuzzy matches for the new query.
    setIsLoading(true);
    const timer = window.setTimeout(() => {
      searchApp({
        limit: SEARCH_LIMIT,
        offset: 0,
        query: normalizedQuery,
        ...(module ? { module } : {}),
        signal: controller.signal,
      })
        .then((items) => {
          if (
            generation.current !== requestGeneration ||
            controller.signal.aborted
          )
            return;
          const stableItems = reuseResults(snapshot.current.items, items);
          snapshot.current = { items: stableItems };
          setResults((current) => reuseResults(current, stableItems));
          setHasMore(items.length === SEARCH_LIMIT);
          settledGeneration.current = requestGeneration;
          setSettledQuery(normalizedQuery);
        })
        .catch((requestError: Error) => {
          if (
            !controller.signal.aborted &&
            generation.current === requestGeneration
          ) {
            failedPage.current = "initial";
            snapshot.current = { items: [] };
            setResults([]);
            setSettledQuery("");
            setError(requestError.message);
          }
        })
        .finally(() => {
          if (
            !controller.signal.aborted &&
            generation.current === requestGeneration
          )
            setIsLoading(false);
        });
    }, 150);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [isQueryReady, normalizedQuery, module, initialRetry, userPermissions]);

  useEffect(() => {
    if (
      !offset ||
      settledQuery !== normalizedQuery ||
      settledGeneration.current !== generation.current
    )
      return;
    const requestGeneration = generation.current;
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    searchApp({
      limit: SEARCH_LIMIT,
      offset,
      query: settledQuery,
      ...(module ? { module } : {}),
      signal: controller.signal,
    })
      .then((items) => {
        if (
          controller.signal.aborted ||
          generation.current !== requestGeneration
        )
          return;
        const seen = new Set(snapshot.current.items.map(resultKey));
        const combined = [
          ...snapshot.current.items,
          ...items.filter((item) => {
            const key = resultKey(item);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          }),
        ];
        snapshot.current = { items: combined };
        setResults(combined);
        setHasMore(items.length === SEARCH_LIMIT && offset < SEARCH_MAX_OFFSET);
        setLimitReached(
          items.length === SEARCH_LIMIT && offset >= SEARCH_MAX_OFFSET,
        );
      })
      .catch((requestError: Error) => {
        if (
          !controller.signal.aborted &&
          generation.current === requestGeneration
        ) {
          failedPage.current = "next";
          setError(requestError.message);
          setHasMore(false);
        }
      })
      .finally(() => {
        if (
          !controller.signal.aborted &&
          generation.current === requestGeneration
        )
          setIsLoading(false);
      });
    return () => controller.abort();
  }, [offset, settledQuery, normalizedQuery, module, pageRetry]);

  const currentGeneration = generation.current;
  const loadMore = useCallback(() => {
    if (
      !hasMore ||
      isLoading ||
      error ||
      settledQuery !== normalizedQuery ||
      currentGeneration !== generation.current ||
      settledGeneration.current !== currentGeneration
    )
      return;
    const nextOffset = offset + SEARCH_LIMIT;
    if (
      nextOffset > SEARCH_MAX_OFFSET ||
      (requestedPage.current?.generation === currentGeneration &&
        requestedPage.current.offset >= nextOffset)
    )
      return;
    requestedPage.current = {
      generation: currentGeneration,
      offset: nextOffset,
    };
    setOffset(nextOffset);
  }, [
    hasMore,
    isLoading,
    error,
    settledQuery,
    normalizedQuery,
    offset,
    currentGeneration,
  ]);

  useEffect(() => {
    if (
      !hasMore ||
      isLoading ||
      error ||
      settledQuery !== normalizedQuery ||
      !sentinel.current ||
      typeof IntersectionObserver === "undefined"
    )
      return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect();
          loadMore();
        }
      },
      { rootMargin: "160px" },
    );
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [
    hasMore,
    isLoading,
    error,
    settledQuery,
    normalizedQuery,
    results.length,
    loadMore,
  ]);

  const retry = () =>
    failedPage.current === "next"
      ? setPageRetry((value) => value + 1)
      : setInitialRetry((value) => value + 1);
  return {
    results,
    settledQuery,
    isQueryReady,
    isLoading,
    error,
    hasMore,
    limitReached,
    loadMore,
    retry,
    sentinel,
  };
}
