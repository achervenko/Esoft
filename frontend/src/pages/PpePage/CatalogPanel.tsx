import { CatalogFiltersModal } from "./CatalogFiltersModal";
import { createCatalogColumns } from "./catalog-columns";
import {
  emptyCatalogFilters,
  filterCatalogItems,
  getCatalogHeightOptions,
  type CatalogFilters,
} from "./catalog-filtering";
import "../../shared/ui/SearchInput.css";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { CatalogContextMenu } from "./CatalogContextMenu";
import { useState } from "react";
import { ppeApi, type PpeItem } from "../../shared/api/ppe";
import { DataTable } from "../../shared/ui/DataTable";
import { canManagePpeCatalog } from "../../modules/ppe-permissions/ppe-permissions";
import { PpeConfirm } from "./PpeConfirm";
import { SizeCatalogModal } from "./SizeCatalogModal";
import { CatalogItemForm } from "./CatalogItemForm";

export function CatalogPanel({
  items,
  role,
  onChanged,
}: {
  items: PpeItem[];
  role: string | null;
  onChanged: () => void;
}) {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<CatalogFilters>({
    ...emptyCatalogFilters,
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const heightOptions = getCatalogHeightOptions(items);
  const [form, setForm] = useState<PpeItem | "new" | null>(null);
  const [sizes, setSizes] = useState<number | null>(null);
  const [toggle, setToggle] = useState<PpeItem | null>(null);
  const [menu, setMenu] = useState<{
    item: PpeItem;
    x: number;
    y: number;
  } | null>(null);
  const manage = canManagePpeCatalog(role);
  const selected = items.find((item) => item.id === sizes);
  const columns = createCatalogColumns(setSizes);
  const rows = filterCatalogItems(items, search, filters);
  return (
    <>
      <div className="ppe-catalog-toolbar">
        <div className="ppe-journal-search search-input-shell">
          <Search size={18} aria-hidden="true" />
          <input
            autoFocus
            aria-label="Поиск по номенклатуре"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="ppe-journal-icon-button"
              aria-label="Очистить поиск"
              onClick={() => setSearch("")}
            >
              <X size={18} aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            className={
              "ppe-journal-icon-button" +
              (activeFilterCount ? " ppe-journal-filter-active" : "")
            }
            aria-label="Фильтры"
            title="Фильтры"
            aria-haspopup="dialog"
            aria-expanded={filtersOpen}
            onClick={() => {
              setFiltersOpen(true);
            }}
          >
            <SlidersHorizontal size={20} aria-hidden="true" />
            {activeFilterCount > 0 && (
              <span className="ppe-journal-filter-count">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
        {manage && (
          <button
            className="admin-primary-button"
            onClick={() => setForm("new")}
          >
            Добавить СИЗ
          </button>
        )}
      </div>
      {filtersOpen && (
        <CatalogFiltersModal
          filters={filters}
          heightOptions={heightOptions}
          onClose={() => setFiltersOpen(false)}
          onApply={(next) => {
            setFilters(next);
            setFiltersOpen(false);
          }}
        />
      )}
      {rows.length ? (
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(item) => item.id}
          defaultSort={{ key: "article", direction: "asc" }}
          onRowContextMenu={
            manage
              ? (item, position) => setMenu({ item, ...position })
              : undefined
          }
        />
      ) : items.length ? (
        <p className="admin-state">Ничего не найдено. Измените фильтры.</p>
      ) : null}
      {menu && manage && (
        <CatalogContextMenu
          x={menu.x}
          y={menu.y}
          active={menu.item.isActive}
          onClose={() => setMenu(null)}
          onEdit={() => {
            setForm(menu.item);
            setMenu(null);
          }}
          onToggle={() => {
            setToggle(menu.item);
            setMenu(null);
          }}
        />
      )}
      {form && (
        <CatalogItemForm
          item={form === "new" ? null : form}
          onClose={() => setForm(null)}
          onChanged={onChanged}
        />
      )}
      {selected && (
        <SizeCatalogModal
          item={selected}
          manage={manage}
          onClose={() => setSizes(null)}
          onChanged={onChanged}
        />
      )}
      {toggle && (
        <PpeConfirm
          title={toggle.isActive ? "Отключить СИЗ?" : "Включить СИЗ?"}
          text={`${toggle.article} — ${toggle.name}. ${toggle.isActive ? "Позиция останется в истории, но её нельзя будет выбрать для новой выдачи." : "Позиция станет доступна для новых выдач."}`}
          onClose={() => setToggle(null)}
          onConfirm={async () => {
            await ppeApi.itemStatus(toggle.id, !toggle.isActive);
            onChanged();
          }}
        />
      )}
    </>
  );
}
