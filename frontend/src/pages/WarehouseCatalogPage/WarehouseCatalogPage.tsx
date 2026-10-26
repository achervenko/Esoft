import { useState } from "react";
import { hasPermission } from "../../shared/lib/permissions";
import { SearchToolbar } from "../../shared/ui/SearchToolbar";
import { CheckboxFilterModal } from "../../shared/ui/CheckboxFilterModal";
import { ListLoadMore } from "../../shared/ui/ListLoadMore";
import { Notice } from "../../shared/ui/Notice";
import { useWarehouseCatalog } from "./useWarehouseCatalog";
import { WarehouseCatalogCards } from "./WarehouseCatalogCards";
import { WarehouseCatalogItemForm } from "./WarehouseCatalogItemForm";
import "../../shared/ui/AdminPage.css";
import "./WarehouseCatalogPage.css";
const statuses = [
  { value: "true", label: "Активные" },
  { value: "false", label: "Неактивные" },
];
export function WarehouseCatalogPage({
  userPermissions,
}: {
  userPermissions: readonly string[] | null;
}) {
  const canManage = hasPermission(userPermissions, "warehouse.catalog.manage");
  const page = useWarehouseCatalog(canManage);
  const [filtersOpen, setFiltersOpen] = useState(false);
  if (!canManage)
    return (
      <section className="admin-page">
        <Notice tone="error">
          Недостаточно прав для просмотра номенклатуры склада.
        </Notice>
      </section>
    );
  const filtered = !!(page.query.search.trim() || page.query.active);
  return (
    <section className="admin-page warehouse-catalog-page">
      <header className="admin-page-header">
        <h1>Номенклатура</h1>
      </header>
      <SearchToolbar
        value={page.query.search}
        onChange={page.setSearch}
        label="Поиск складской номенклатуры"
        onCreate={() => page.openForm("new")}
        createAriaLabel="Добавить номенклатуру"
        createDisabled={page.saving}
        filters={{
          label: "Настройки поиска номенклатуры",
          count: page.query.active ? 1 : 0,
          onOpen: () => setFiltersOpen(true),
        }}
      />
      <section className="warehouse-catalog-surface">
        {page.loadError && !page.data ? (
          <Notice tone="error">
            {page.loadError}
            <button
              type="button"
              className="admin-secondary-button"
              onClick={page.list.retry}
            >
              Повторить загрузку
            </button>
          </Notice>
        ) : page.loading && !page.data ? (
          <p className="admin-state" role="status">
            Загрузка…
          </p>
        ) : (
          page.data && (
            <>
              {page.data.items.length ? (
                <WarehouseCatalogCards
                  items={page.data.items}
                  canManage={canManage}
                  onEdit={page.openForm}
                />
              ) : (
                <p className="admin-state">
                  {filtered
                    ? "По заданным условиям ничего не найдено."
                    : "Номенклатура пока не добавлена."}
                </p>
              )}
              <ListLoadMore
                list={page.list}
                disabled={page.editing !== null || page.saving}
              />
            </>
          )
        )}
      </section>
      {filtersOpen && (
        <CheckboxFilterModal
          title="Настройки поиска"
          legend="Статус"
          options={statuses}
          values={page.query.active ? [page.query.active] : []}
          onClose={() => setFiltersOpen(false)}
          onApply={(values) => {
            page.setActive(values.length === 1 ? values[0] : "");
            setFiltersOpen(false);
          }}
        />
      )}
      {page.editing && (
        <WarehouseCatalogItemForm
          item={page.editing === "new" ? null : page.editing}
          saving={page.saving}
          error={page.mutationError}
          onSave={page.save}
          onClose={page.closeForm}
          onToggle={() =>
            page.editing && page.editing !== "new"
              ? page.toggle(page.editing)
              : Promise.resolve()
          }
        />
      )}
    </section>
  );
}
