import { memo } from "react";
import { EquipmentStatusBadge } from "../../modules/equipment-status";
import type { SearchResultItem } from "../../shared/api/search-api";
import { buildHashRoute } from "../../shared/lib/hash-navigation";

function getResultHref(item: SearchResultItem) {
  if (item.targetUrl?.startsWith("#/equipment/")) {
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

  return entityType;
}

function getEquipmentStatusLabel(status: string | null) {
  const labels: Record<string, string> = {
    active: "В эксплуатации",
    maintenance: "На обслуживании",
    repair: "В ремонте",
    reserve: "Резерв",
    written_off: "Списано",
  };

  return status ? labels[status] ?? status : null;
}

function getEquipmentMeta(item: SearchResultItem) {
  return [
    item.details.manufacturer
      ? `Производитель: ${item.details.manufacturer}`
      : null,
    item.details.model ? `Модель: ${item.details.model}` : null,
    item.details.serialNumber
      ? `Заводской номер: ${item.details.serialNumber}`
      : null,
  ].filter((value): value is string => Boolean(value));
}

function SearchResultsComponent({ items }: { items: SearchResultItem[] }) {
  if (items.length === 0) {
    return <p className="admin-state">Ничего не найдено.</p>;
  }

  return (
    <ul className="search-results">
      {items.map((item) => (
        <li key={`${item.entityType}:${item.entityId}`}>
          <a href={getResultHref(item)}>
            <div className="search-result-header">
              <div>
                <span className="search-result-type">
                  {getEntityLabel(item.entityType)}
                </span>
                <strong>{item.title}</strong>
              </div>

              {item.details.status ? (
                <EquipmentStatusBadge
                  label={getEquipmentStatusLabel(item.details.status) ?? ""}
                  status={item.details.status}
                />
              ) : null}
            </div>

            <div className="search-result-meta">
              {getEquipmentMeta(item).map((meta) => (
                <span key={meta}>{meta}</span>
              ))}
            </div>

            <div className="search-result-details">
              {item.details.location ? (
                <span>Местонахождение: {item.details.location}</span>
              ) : null}
              {item.details.responsible ? (
                <span>Ответственный: {item.details.responsible}</span>
              ) : null}
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}

export const SearchResults = memo(SearchResultsComponent);
