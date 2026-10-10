import { memo, useCallback, useState } from "react";
import type { SearchResultItem } from "../../shared/api/search-api";
import { buildHashRoute } from "../../shared/lib/hash-navigation";

function getResultHref(item: SearchResultItem) {
  if (item.targetUrl && (item.targetUrl.startsWith("#/equipment/") || item.targetUrl.startsWith("#/ppe"))) {
    return buildHashRoute(item.targetUrl, {
      returnTo: window.location.hash,
    });
  }

  if (item.targetUrl) {
    return item.targetUrl;
  }

  if (item.entityType === "equipment") {
    return "#/equipment";
  }

  return "#/search";
}

function getEntityLabel(entityType: string) {
  if (entityType === "equipment") {
    return "Оборудование";
  }

  if (entityType === "ppe_norm") return "Нормы";
  if (entityType === "ppe_item") return "СИЗ";
  if (entityType === "employee") return "Сотрудник";
  return entityType;
}

const SearchResultCard = memo(function SearchResultCard({ item, href, visited, onVisit }: { item: SearchResultItem; href: string; visited: boolean; onVisit: (key: string) => void }) {
  return (
    <li>
      <a href={href} className={visited ? "search-result-visited" : undefined} onClick={() => onVisit(`${item.entityType}:${item.entityId}`)}>
        <span className="search-result-title">{item.title}</span>
        <span className="search-result-type">{getEntityLabel(item.entityType)}</span>
        {item.subtitle && <small>{item.subtitle}</small>}
      </a>
    </li>
  );
});

const VISITED_KEY = "search-viewed-results";
function searchVisitKey(hash: string) {
  const [path, query = ""] = hash.split("?");
  const params = new URLSearchParams(query);
  params.sort();
  return path + (params.size ? `?${params}` : "");
}
function SearchResultsComponent({ items }: { items: SearchResultItem[] }) {
  const route = searchVisitKey(window.location.hash);
  const [visited, setVisited] = useState<{ route: string; keys: string[] }>(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(VISITED_KEY) ?? "null");
      return saved && typeof saved.route === "string" && Array.isArray(saved.keys)
        ? { route: searchVisitKey(saved.route), keys: saved.keys } : { route, keys: [] };
    }
    catch { return { route, keys: [] }; }
  });
  const onVisit = useCallback((key: string) => {
    const next = { route, keys: [...new Set([...(visited.route === route ? visited.keys : []), key])] };
    // Persist before navigation can unmount the search page.
    try { sessionStorage.setItem(VISITED_KEY, JSON.stringify(next)); } catch { /* Browsing still works without storage. */ }
    setVisited(next);
  }, [route, visited]);
  if (items.length === 0) {
    return <p className="search-empty-state">Ничего не найдено.</p>;
  }

  return (
    <ul className="search-results">
      {items.map((item) => (
        <SearchResultCard key={`${item.entityType}:${item.entityId}`} item={item} href={getResultHref(item)} visited={visited.route === route && visited.keys.includes(`${item.entityType}:${item.entityId}`)} onVisit={onVisit} />
      ))}
    </ul>
  );
}

export const SearchResults = memo(SearchResultsComponent);
