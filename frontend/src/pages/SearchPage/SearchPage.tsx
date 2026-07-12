import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  searchApp,
  type SearchResultItem,
} from "../../shared/api/search-api";
import "../../shared/ui/AdminPage.css";
import "./SearchPage.css";
import { SearchResults } from "./SearchResults";

const SEARCH_LIMIT = 20;
const MIN_QUERY_LENGTH = 2;

function getSearchQueryFromHash() {
  const [, queryString = ""] = window.location.hash.split("?");
  const params = new URLSearchParams(queryString);

  return params.get("q") ?? "";
}

function replaceSearchQueryInHash(query: string) {
  const cleanQuery = query.trim();
  const nextHash = cleanQuery
    ? `#/search?q=${encodeURIComponent(cleanQuery)}`
    : "#/search";

  if (window.location.hash !== nextHash) {
    window.history.replaceState(null, "", nextHash);
  }
}

function areSearchResultsEqual(
  previousItems: SearchResultItem[],
  nextItems: SearchResultItem[],
) {
  if (previousItems.length !== nextItems.length) {
    return false;
  }

  return previousItems.every((previousItem, index) => {
    const nextItem = nextItems[index];

    return (
      previousItem.id === nextItem.id &&
      previousItem.entityType === nextItem.entityType &&
      previousItem.entityId === nextItem.entityId &&
      previousItem.title === nextItem.title &&
      previousItem.subtitle === nextItem.subtitle &&
      previousItem.targetUrl === nextItem.targetUrl &&
      previousItem.details.location === nextItem.details.location &&
      previousItem.details.manufacturer === nextItem.details.manufacturer &&
      previousItem.details.model === nextItem.details.model &&
      previousItem.details.responsible === nextItem.details.responsible &&
      previousItem.details.serialNumber === nextItem.details.serialNumber &&
      previousItem.details.status === nextItem.details.status
    );
  });
}

export function SearchPage() {
  const [query, setQuery] = useState(getSearchQueryFromHash);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedQuery = useMemo(() => query.trim(), [query]);
  const isQueryReady = normalizedQuery.length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    replaceSearchQueryInHash(query);
  }, [query]);

  useEffect(() => {
    if (!isQueryReady) {
      setResults([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const timeoutId = window.setTimeout(() => {
      setIsLoading(true);
      setError(null);

      searchApp({
        limit: SEARCH_LIMIT,
        offset: 0,
        query: normalizedQuery,
      })
        .then((items) => {
          if (isMounted) {
            setResults((previousItems) =>
              areSearchResultsEqual(previousItems, items)
                ? previousItems
                : items,
            );
          }
        })
        .catch((requestError: Error) => {
          if (isMounted) {
            setResults([]);
            setError(requestError.message);
          }
        })
        .finally(() => {
          if (isMounted) {
            setIsLoading(false);
          }
        });
    }, 250);

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [isQueryReady, normalizedQuery]);

  return (
    <div className="admin-page search-page">
      <header className="admin-page-header">
        <div>
          <h1>Поиск</h1>
        </div>
      </header>

      <section
        aria-busy={isLoading}
        aria-label="Поиск по системе"
        className="admin-card search-card"
      >
        <label className="search-field">
          <div className="search-input-shell">
            <Search aria-hidden="true" size={19} />
            <input
              aria-label="Поиск"
              autoFocus
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Название, инвентарный номер, модель, ответственный..."
              type="search"
              value={query}
            />
          </div>
        </label>

        {!isQueryReady ? (
          <p className="admin-state">Введите минимум 2 символа.</p>
        ) : null}

        {error ? <p className="admin-form-error">{error}</p> : null}

        {!error && isQueryReady ? (
          <SearchResults items={results} />
        ) : null}
      </section>
    </div>
  );
}
