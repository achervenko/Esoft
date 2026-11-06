import { useState } from "react";
import { hasPermission } from "../../shared/lib/permissions";
import { setHashRoute } from "../../lib/hash-router";
import { SearchToolbar } from "../../shared/ui/SearchToolbar";
import { ListLoadMore } from "../../shared/ui/ListLoadMore";
import { Notice } from "../../shared/ui/Notice";
import { LoadingIndicator } from "../../shared/ui/LoadingIndicator";
import { ReceiptListTable } from "./ReceiptListTable";
import { ReceiptListFilters } from "./ReceiptListFilters";
import { useReceiptList } from "./useReceiptList";
import { useReceiptStorage } from "./useReceiptStorage";
import type { ReceiptListPreferences } from "./receipt-list-preferences";

export function ReceiptList({
  permissions,
  preferences,
  onChange,
}: {
  permissions: readonly string[] | null;
  preferences: ReceiptListPreferences;
  onChange: (value: ReceiptListPreferences) => void;
}) {
  const {
    sort,
    search,
    warehouseId,
    source,
    states,
    problems,
    documentDateFrom,
    documentDateTo,
  } = preferences;
  const { query, invalidPeriod } = useReceiptList(preferences);
  const update = (patch: Partial<ReceiptListPreferences>) =>
    onChange({ ...preferences, ...patch });
  const [filters, setFilters] = useState(false);
  const choices = useReceiptStorage(
    "",
    false,
    hasPermission(permissions, "warehouse.storage-locations.read"),
  );
  const open = (id: string) => setHashRoute(`#/warehouse/receipts/${id}`);
  return (
    <>
      <header className="admin-page-header">
        <h1>Приходы</h1>
      </header>
      <SearchToolbar
        value={search}
        onChange={(search) => update({ search })}
        label="Поиск по номеру документа, товару или артикулу"
        createAriaLabel="Ручной приход"
        onCreate={
          hasPermission(permissions, "warehouse.receipts.manage")
            ? () => setHashRoute("#/warehouse/receipts/new")
            : undefined
        }
        filters={{
          label: "Фильтры приходов",
          count:
            [
              warehouseId,
              source,
              problems,
              documentDateFrom || documentDateTo,
            ].filter(Boolean).length + (states.length ? 1 : 0),
          onOpen: () => setFilters(true),
          expanded: filters,
        }}
      />
      <LoadingIndicator loading={query.loading && !query.data} />
      {query.error && !query.data && (
        <Notice tone="error">
          {query.error}
          <button className="admin-secondary-button" onClick={query.retry}>
            Повторить
          </button>
        </Notice>
      )}
      {choices.error && (
        <Notice tone="error">
          {choices.error}
          <button className="admin-secondary-button" onClick={choices.retry}>
            Повторить
          </button>
        </Notice>
      )}
      {query.data && (
        <>
          <section className="admin-card receipt-table receipt-list-table">
            <ReceiptListTable
              items={query.data.items}
              onOpen={open}
              sort={sort}
              onSortChange={(sort) => update({ sort })}
            />
            {query.data.items.length === 0 && <p>Приходы не найдены.</p>}
          </section>
          <ListLoadMore list={query} disabled={filters || invalidPeriod} />
        </>
      )}
      {filters && (
        <ReceiptListFilters
          preferences={preferences}
          warehouses={choices.warehouses}
          invalidPeriod={invalidPeriod}
          onChange={update}
          onClose={() => setFilters(false)}
        />
      )}
    </>
  );
}
