import { LoadingIndicator } from "../../shared/ui/LoadingIndicator";
import { Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  searchApp,
  type SearchResultItem,
} from "../../shared/api/search-api";
import "../../shared/ui/AdminPage.css";
import "./SearchPage.css";
import { SearchResults } from "./SearchResults";
import { availableSearchModules, permittedModuleFilter } from "./search-modules";
import { SearchFiltersModal } from "./SearchFiltersModal";
import "../../shared/ui/SearchToolbar.css";

const SEARCH_LIMIT = 20;
const SEARCH_MAX_OFFSET = 1000;
const MIN_QUERY_LENGTH = 2;

function getSearchQueryFromHash() {
  const [, queryString = ""] = window.location.hash.split("?");
  const params = new URLSearchParams(queryString);

  return params.get("q") ?? "";
}

function replaceSearchQueryInHash(query: string, module = "") {
  const cleanQuery = query.trim();
  const params = new URLSearchParams();
  if (cleanQuery) params.set("q", cleanQuery);
  if (module) params.set("module", module);
  const nextHash = "#/search" + (params.size ? `?${params.toString().replace(/\+/g, "%20")}` : "");

  if (window.location.hash !== nextHash) {
    window.history.replaceState(window.history.state, "", nextHash);
  }
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ");
}

function resultKey(item: SearchResultItem) {
  return `${item.entityType}:${item.entityId}`;
}

function reuseResults(previous: SearchResultItem[], incoming: SearchResultItem[]) {
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
  return previous.length === next.length && previous.every((item, index) => item === next[index])
    ? previous : next;
}

export function SearchPage({ userPermissions = null }: { userPermissions?: readonly string[] | null }) {
  const [module, setModule] = useState<string>(() => {
    const value = new URLSearchParams(window.location.hash.split("?")[1]).get("module");
    return permittedModuleFilter(value, userPermissions);
  });
  const availableModules = availableSearchModules(userPermissions);
  const moduleRef = useRef(module);
  const permissionsRef = useRef(userPermissions);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const snapshot = useRef<{ query: string; items: SearchResultItem[] }>({ query: "", items: [] });
  const generation = useRef(0);
  const settledGeneration = useRef<number | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [initialRetry, setInitialRetry] = useState(0);
  const [pageRetry, setPageRetry] = useState(0);
  const failedPage = useRef<"initial" | "next">("initial");
  const [limitReached, setLimitReached] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [settledQuery, setSettledQuery] = useState("");
  const [query, setQuery] = useState(getSearchQueryFromHash);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedQuery = useMemo(() => normalize(query), [query]);
  const isQueryReady = normalizedQuery.length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    const syncQueryFromHash = () => {
      if (window.location.hash.split("?")[0] === "#/search") {
        setQuery(getSearchQueryFromHash());
        const value = new URLSearchParams(window.location.hash.split("?")[1]).get("module");
        setModule(permittedModuleFilter(value, userPermissions));
      }
    };
    syncQueryFromHash();
    window.addEventListener("hashchange", syncQueryFromHash);
    return () => window.removeEventListener("hashchange", syncQueryFromHash);
  }, [userPermissions]);

  useEffect(() => {
    const cleanQuery = normalize(normalizedQuery);
    if (moduleRef.current !== module || permissionsRef.current !== userPermissions) {
      permissionsRef.current = userPermissions;
      moduleRef.current = module;
      snapshot.current = { query: "", items: [] };
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
      snapshot.current = { query: "", items: [] };
      return;
    }
    // Keep the last response until the server resolves fuzzy matches for the new query.
    setIsLoading(true);
    const timer = window.setTimeout(() => {
      searchApp({ limit: SEARCH_LIMIT, offset: 0, query: normalizedQuery, ...(module ? { module } : {}), signal: controller.signal })
        .then((items) => {
          if (generation.current !== requestGeneration || controller.signal.aborted) return;
          const stableItems = reuseResults(snapshot.current.items, items);
          snapshot.current = { query: cleanQuery, items: stableItems };
          setResults((current) => reuseResults(current, stableItems));
          setHasMore(items.length === SEARCH_LIMIT);
          settledGeneration.current = requestGeneration;
          setSettledQuery(normalizedQuery);
        })
        .catch((requestError: Error) => {
          if (!controller.signal.aborted && generation.current === requestGeneration) {
            failedPage.current = "initial";
            snapshot.current = { query: "", items: [] };
            setResults([]);
            setSettledQuery("");
            setError(requestError.message);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted && generation.current === requestGeneration) setIsLoading(false);
        });
    }, 150);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [isQueryReady, normalizedQuery, module, initialRetry, userPermissions]);

  useEffect(() => {
    if (!offset || settledQuery !== normalizedQuery ||
        settledGeneration.current !== generation.current) return;
    const requestGeneration = generation.current;
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    searchApp({ limit: SEARCH_LIMIT, offset, query: settledQuery, ...(module ? { module } : {}), signal: controller.signal })
      .then((items) => {
        if (controller.signal.aborted || generation.current !== requestGeneration) return;
        const seen = new Set(snapshot.current.items.map(resultKey));
        const combined = [...snapshot.current.items, ...items.filter((item) => {
          const key = resultKey(item);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })];
        snapshot.current = { query: normalize(settledQuery), items: combined };
        setResults(combined);
        setHasMore(items.length === SEARCH_LIMIT && offset < SEARCH_MAX_OFFSET);
        setLimitReached(items.length === SEARCH_LIMIT && offset >= SEARCH_MAX_OFFSET);
      })
      .catch((requestError: Error) => {
        if (!controller.signal.aborted && generation.current === requestGeneration) {
          failedPage.current = "next";
          setError(requestError.message);
          setHasMore(false);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted && generation.current === requestGeneration) setIsLoading(false);
      });
    return () => controller.abort();
  }, [offset, settledQuery, normalizedQuery, module, pageRetry]);

  useEffect(() => {
    if (!hasMore || isLoading || error || settledQuery !== normalizedQuery || !sentinel.current ||
        typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        observer.disconnect();
        setOffset((value) => value + SEARCH_LIMIT);
      }
    }, { rootMargin: "160px" });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [hasMore, isLoading, error, settledQuery, normalizedQuery, results.length]);

  return (
    <div className="admin-page search-page">
      <section
        aria-busy={isLoading}
        aria-label="Поиск по системе"
        className="search-card"
      >
        <div className="admin-card search-toolbar">
        <div className="search-field">
          <div className="search-input-shell">
            <Search aria-hidden="true" size={19} />
            <input
              aria-label="Поиск"
              autoFocus
              onChange={(event) => {
                const nextQuery = event.target.value;
                setQuery(nextQuery);
                replaceSearchQueryInHash(nextQuery, module);
              }}
              placeholder=""
              type="search"
              value={query}
            />
            {availableModules.length > 0 && (
              <button type="button" className={"ppe-journal-icon-button" + (module ? " ppe-journal-filter-active" : "")}
                aria-label="Фильтры" title="Фильтры" aria-haspopup="dialog" aria-expanded={filtersOpen}
                onClick={() => setFiltersOpen(true)}>
                <SlidersHorizontal size={20} aria-hidden="true" />
                {module && <span className="ppe-journal-filter-count">{module.split(",").length}</span>}
              </button>
            )}
          </div>
        </div>

        </div>

        {filtersOpen && availableModules.length > 0 && (
          <SearchFiltersModal availableModules={availableModules} module={module} onClose={() => setFiltersOpen(false)} onApply={(value) => {
            setModule(value);
            replaceSearchQueryInHash(query, value);
            setFiltersOpen(false);
          }} />
        )}
        {isQueryReady && (results.length > 0 || (!isLoading && !error)) ? (
          <SearchResults items={results} query={settledQuery} />
        ) : null}
        <div className="search-loading-footer" ref={sentinel}>
          <LoadingIndicator loading={isLoading} />
          {hasMore && !isLoading && !error && (
            <button type="button" className="admin-secondary-button" onClick={() => setOffset((value) => value + SEARCH_LIMIT)}>
              Показать ещё
            </button>
          )}
        </div>
        {limitReached && !error && (
          <p className="search-limit-message" role="status">
            Показаны первые 1020 результатов. Уточните запрос или фильтры, чтобы найти нужную запись.
          </p>
        )}
        {error && (
          <div className="search-error-state">
            <p className="admin-form-error" role="alert">{error}</p>
            <button type="button" className="admin-secondary-button" disabled={isLoading} onClick={() => failedPage.current === "next" ? setPageRetry((value) => value + 1) : setInitialRetry((value) => value + 1)}>
              Повторить загрузку
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
