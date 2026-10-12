import { memo, useCallback, useMemo, useState, type ReactNode } from "react";
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

const matchLabels: Record<string, string> = {
  manufacturer: "Производитель", model: "Модель", workshop: "Цех",
  responsible: "Ответственный", serialNumber: "Серийный номер",
};

function normalizeVisible(value: string) {
  return value.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}

function hiddenMatches(item: SearchResultItem) {
  const visible = [item.title, item.subtitle ?? "", getEntityLabel(item.entityType)].map(normalizeVisible);
  const seen = new Set<string>();
  return (item.matches ?? []).filter(({ field, value }) => {
    const normalized = normalizeVisible(value);
    if (!matchLabels[field] || !normalized || seen.has(normalized) || visible.some((text) => text.includes(normalized))) return false;
    seen.add(normalized);
    return true;
  });
}

function highlightMatch(value: string, pattern: RegExp | null) {
  if (!pattern) return { content: value as ReactNode, exact: true };
  const parts: ReactNode[] = [];
  let end = 0;
  for (const match of value.matchAll(pattern)) {
    const start = match.index;
    parts.push(value.slice(end, start), <strong key={start}>{match[0]}</strong>);
    end = start + match[0].length;
  }
  if (!parts.length) return { content: value as ReactNode, exact: false };
  parts.push(value.slice(end));
  return { content: parts, exact: true };
}

const SearchResultCard = memo(function SearchResultCard({ item, pattern, href, visited, onVisit }: { item: SearchResultItem; pattern: RegExp | null; href: string; visited: boolean; onVisit: (key: string) => void }) {
  const matches = hiddenMatches(item);
  const highlighted = matches.map((match) => ({ ...match, ...highlightMatch(match.value, pattern) }));
  return (
    <li>
      <a href={href} className={visited ? "search-result-visited" : undefined} onClick={() => onVisit(`${item.entityType}:${item.entityId}`)}>
        <span className="search-result-title">{item.title}</span>
        <span className="search-result-type">{getEntityLabel(item.entityType)}</span>
        {item.subtitle && <small>{item.subtitle}</small>}
        {[true, false].map((exact) => {
          const group = highlighted.filter((match) => match.exact === exact);
          return group.length > 0 && <small key={String(exact)} className="search-result-match">
            {exact ? "Совпадение: " : "Похоже на: "}
            {group.map(({ field, content }, index) => <span key={field}>{index > 0 ? " · " : ""}{matchLabels[field]} — {content}</span>)}
          </small>;
        })}
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
function SearchResultsComponent({ items, query = "" }: { items: SearchResultItem[]; query?: string }) {
  // Compile once per completed response; literal matches need no fuzzy calculation.
  const pattern = useMemo(() => {
    const normalized = normalizeVisible(query);
    if (!normalized) return null;
    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/е/g, "[её]").replace(/ /g, "\\s+");
    return new RegExp(escaped, "giu");
  }, [query]);
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
        <SearchResultCard key={`${item.entityType}:${item.entityId}`} item={item} pattern={pattern} href={getResultHref(item)} visited={visited.route === route && visited.keys.includes(`${item.entityType}:${item.entityId}`)} onVisit={onVisit} />
      ))}
    </ul>
  );
}

export const SearchResults = memo(SearchResultsComponent, (previous, next) =>
  previous.items === next.items &&
  previous.query === next.query,
);
