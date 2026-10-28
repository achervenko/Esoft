import { useState } from "react";
import { SearchToolbar } from "../../shared/ui/SearchToolbar";
import { AdminModal } from "../../shared/ui/AdminModal";
import { SelectField } from "../../shared/ui/SelectField";
import { Notice } from "../../shared/ui/Notice";
import { ListLoadMore } from "../../shared/ui/ListLoadMore";
import { hasPermission } from "../../shared/lib/permissions";
import { useMediaQuery } from "../../shared/lib/useMediaQuery";
import type { StockPosition } from "../../shared/api/warehouse-stock-api";
import { useWarehouseStock, type StockSort } from "./useWarehouseStock";
import { useStorageChoices } from "./useStorageChoices";
import { WarehouseStockTable } from "./WarehouseStockTable";
import { StockDistributionModal } from "./StockDistributionModal";
import { WarehouseStockCards } from "./WarehouseStockCards";
import "../../shared/ui/AdminPage.css";
import "./WarehouseStockPage.css";
export function WarehouseStockPage({
  userPermissions,
}: {
  userPermissions: readonly string[] | null;
}) {
  const enabled = hasPermission(userPermissions, "warehouse.stock.read");
  const canTransfer = hasPermission(
    userPermissions,
    "warehouse.transfers.manage",
  );
  const page = useWarehouseStock(enabled),
    choices = useStorageChoices(enabled, page.warehouseId);
  const mobile = useMediaQuery("(max-width: 760px)");
  const [selected, setSelected] = useState<StockPosition | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const list = page.list,
    rows = list.data?.items ?? [];
  const stale = list.isPreviousData;
  const filtered = !!(
    page.search ||
    page.warehouseId ||
    page.locationId ||
    page.quantityState !== "POSITIVE"
  );
  if (!enabled)
    return (
      <section className="admin-page">
        <Notice tone="error">Недостаточно прав для просмотра остатков.</Notice>
      </section>
    );
  return (
    <section className="admin-page warehouse-stock-page">
      <header className="admin-page-header">
        <h1>Остатки</h1>
      </header>
      <SearchToolbar
        value={page.search}
        onChange={page.setSearch}
        label="Поиск остатков по артикулу и наименованию"
        inputProps={{ maxLength: 255 }}
        filters={{
          label: "Настройки поиска остатков",
          count:
            Number(!!page.warehouseId) +
            Number(!!page.locationId) +
            Number(page.quantityState !== "POSITIVE"),
          expanded: filtersOpen,
          onOpen: () => setFiltersOpen(true),
        }}
      />
      {filtersOpen && (
        <AdminModal
          title="Настройки поиска"
          onClose={() => setFiltersOpen(false)}
        >
          <div className="admin-form">
            <SelectField
              label="Склад"
              value={page.warehouseId}
              onChange={page.setWarehouse}
              searchable
              options={[
                { value: "", label: "Все склады" },
                ...choices.warehouses.map((w) => ({
                  value: w.id,
                  label: w.name + (!w.isActive ? " (неактивен)" : ""),
                })),
              ]}
              disabled={choices.loading}
            />
            <SelectField
              label="Место хранения"
              value={page.locationId}
              onChange={page.setLocationId}
              searchable
              options={[
                { value: "", label: "Все места хранения" },
                ...choices.locations.map((l) => ({
                  value: l.id,
                  label:
                    l.name +
                    (!page.warehouseId ? ` — ${l.warehouse.name}` : "") +
                    (!l.isActive ? " (неактивно)" : ""),
                })),
              ]}
              disabled={choices.loading}
            />
            <SelectField
              label="Наличие"
              value={page.quantityState}
              onChange={page.setQuantityState}
              options={[
                { value: "POSITIVE", label: "Только в наличии" },
                { value: "ZERO", label: "Только нулевые" },
                { value: "ALL", label: "Все остатки" },
              ]}
            />
            {choices.error && (
              <Notice tone="error">
                Не удалось загрузить фильтры: {choices.error}
                <button type="button" onClick={choices.retry}>
                  Повторить загрузку фильтров
                </button>
              </Notice>
            )}
            <div className="admin-form-actions">
              <button
                type="button"
                className="admin-secondary-button"
                disabled={!filtered}
                onClick={page.reset}
              >
                Сбросить фильтры
              </button>
              <button
                type="button"
                className="admin-primary-button"
                onClick={() => setFiltersOpen(false)}
              >
                Готово
              </button>
            </div>
          </div>
        </AdminModal>
      )}
      {mobile && (
        <SelectField
          label="Сортировка"
          value={`${page.sort.key}:${page.sort.direction}`}
          onChange={(value) => {
            const [key, direction] = value.split(":");
            page.setSort({
              key: key as StockSort["key"],
              direction: direction as StockSort["direction"],
            });
          }}
          options={[
            { value: "article:asc", label: "Артикул: А–Я" },
            { value: "article:desc", label: "Артикул: Я–А" },
            { value: "name:asc", label: "Наименование: А–Я" },
            { value: "name:desc", label: "Наименование: Я–А" },
            { value: "quantity:asc", label: "Количество: по возрастанию" },
            { value: "quantity:desc", label: "Количество: по убыванию" },
          ]}
        />
      )}
      <section
        className="stock-results"
        aria-label="Складские остатки"
        aria-busy={list.loading}
      >
        {list.error && (!list.data || stale) && (
          <Notice tone="error">
            {list.error}
            <button type="button" onClick={list.retry}>
              Повторить загрузку остатков
            </button>
          </Notice>
        )}
        {list.loading && !list.data ? (
          <p role="status">Загрузка остатков…</p>
        ) : (
          list.data && (
            <>
              {!rows.length && !list.error && (
                <p>
                  {page.search
                    ? "По вашему запросу остатки не найдены."
                    : "Остатки не найдены."}
                </p>
              )}
              {rows.length > 0 &&
                (mobile ? (
                  <WarehouseStockCards
                    rows={rows}
                    disabled={stale}
                    onOpen={setSelected}
                  />
                ) : (
                  <WarehouseStockTable
                    rows={rows}
                    sort={page.sort}
                    onSort={page.setSort}
                    onOpen={setSelected}
                    disabled={stale}
                  />
                ))}
              {!stale && <ListLoadMore list={list} />}
            </>
          )
        )}
      </section>
      {selected && (
        <StockDistributionModal
          key={selected.id}
          position={selected}
          canTransfer={canTransfer}
          onClose={() => setSelected(null)}
          onChanged={page.refresh}
        />
      )}
    </section>
  );
}
