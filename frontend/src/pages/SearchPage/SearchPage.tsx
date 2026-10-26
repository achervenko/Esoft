import { SearchToolbar } from "../../shared/ui/SearchToolbar";
import { LoadingIndicator } from "../../shared/ui/LoadingIndicator";
import { useEffect, useState } from "react";
import "../../shared/ui/AdminPage.css";
import "./SearchPage.css";
import { SearchResults } from "./SearchResults";
import {
  availableSearchModules,
  permittedModuleFilter,
} from "./search-modules";
import { SearchFiltersModal } from "./SearchFiltersModal";

import { useSearchPageQuery } from "./useSearchPageQuery";

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
  const nextHash =
    "#/search" +
    (params.size ? `?${params.toString().replace(/\+/g, "%20")}` : "");

  if (window.location.hash !== nextHash) {
    window.history.replaceState(window.history.state, "", nextHash);
  }
}

export function SearchPage({
  userPermissions = null,
}: {
  userPermissions?: readonly string[] | null;
}) {
  const [module, setModule] = useState<string>(() => {
    const value = new URLSearchParams(window.location.hash.split("?")[1]).get(
      "module",
    );
    return permittedModuleFilter(value, userPermissions);
  });
  const availableModules = availableSearchModules(userPermissions);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [query, setQuery] = useState(getSearchQueryFromHash);
  const {
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
  } = useSearchPageQuery({ query, module, userPermissions });

  useEffect(() => {
    const syncQueryFromHash = () => {
      if (window.location.hash.split("?")[0] === "#/search") {
        setQuery(getSearchQueryFromHash());
        const value = new URLSearchParams(
          window.location.hash.split("?")[1],
        ).get("module");
        setModule(permittedModuleFilter(value, userPermissions));
      }
    };
    syncQueryFromHash();
    window.addEventListener("hashchange", syncQueryFromHash);
    return () => window.removeEventListener("hashchange", syncQueryFromHash);
  }, [userPermissions]);

  return (
    <div className="admin-page search-page">
      <section
        aria-busy={isLoading}
        aria-label="Поиск по системе"
        className="search-card"
      >
        <SearchToolbar
          className="admin-card search-page-toolbar"
          label="Поиск"
          value={query}
          inputProps={{ autoFocus: true }}
          onChange={(value) => {
            setQuery(value);
            replaceSearchQueryInHash(value, module);
          }}
          filters={
            availableModules.length
              ? {
                  label: "Фильтры",
                  title: "Фильтры",
                  count: module ? module.split(",").length : 0,
                  expanded: filtersOpen,
                  onOpen: () => setFiltersOpen(true),
                }
              : undefined
          }
        />
        {filtersOpen && availableModules.length > 0 && (
          <SearchFiltersModal
            availableModules={availableModules}
            module={module}
            onClose={() => setFiltersOpen(false)}
            onApply={(value) => {
              setModule(value);
              replaceSearchQueryInHash(query, value);
              setFiltersOpen(false);
            }}
          />
        )}
        {isQueryReady && (results.length > 0 || (!isLoading && !error)) ? (
          <SearchResults items={results} query={settledQuery} />
        ) : null}
        <div className="search-loading-footer" ref={sentinel}>
          <LoadingIndicator loading={isLoading} />
          {hasMore && !isLoading && !error && (
            <button
              type="button"
              className="admin-secondary-button"
              onClick={loadMore}
            >
              Показать ещё
            </button>
          )}
        </div>
        {limitReached && !error && (
          <p className="search-limit-message" role="status">
            Показаны первые 1020 результатов. Уточните запрос или фильтры, чтобы
            найти нужную запись.
          </p>
        )}
        {error && (
          <div className="search-error-state">
            <p className="admin-form-error" role="alert">
              {error}
            </p>
            <button
              type="button"
              className="admin-secondary-button"
              disabled={isLoading}
              onClick={retry}
            >
              Повторить загрузку
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
