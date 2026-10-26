import { LoadingIndicator } from "../../shared/ui/LoadingIndicator";
import { Plus } from "lucide-react";
import { useState } from "react";
import { canCreateEquipment } from "../../modules/equipment-permissions";
import { getEquipmentRegistry } from "../../shared/api/equipment/equipment.api";
import type { EquipmentRegistryItem } from "../../shared/api/equipment/equipment.types";
import { buildHashRoute } from "../../shared/lib/hash-navigation";
import { useIncrementalList } from "../../shared/lib/useIncrementalList";
import { ListLoadMore } from "../../shared/ui/ListLoadMore";
import {
  EquipmentRegistryTable,
  type EquipmentSortKey,
} from "./EquipmentRegistryTable";
import type { DataTableSortDirection } from "../../shared/ui/DataTable";
import "./EquipmentPage.css";

type EquipmentPageProps = {
  userPermissions: readonly string[] | null;
};

export function EquipmentPage({ userPermissions }: EquipmentPageProps) {
  const isCreateAllowed = canCreateEquipment(userPermissions);
  const [sort, setSort] = useState<{
    key: EquipmentSortKey;
    direction: DataTableSortDirection;
  }>({ key: "visibleId", direction: "asc" });

  const list = useIncrementalList({
    queryKey: JSON.stringify(sort),
    enabled: true,
    getKey: (item: EquipmentRegistryItem) => item.id,
    loadPage: async (offset, signal) => ({
      ...(await getEquipmentRegistry(
        {
          page: Math.floor(offset / 100) + 1,
          sort: sort.key,
          direction: sort.direction,
        },
        signal,
      )),
      limit: 100,
    }),
  });
  const items = list.data?.items ?? [];
  const isLoading = list.loading && !list.data;
  const error = !list.data ? list.error : null;

  const openEquipmentCard = (visibleId: number) => {
    window.location.hash = buildHashRoute(`#/equipment/${visibleId}`, {
      returnTo: "#/equipment",
    });
  };

  return (
    <div className="equipment-page">
      <header className="equipment-page-header">
        <h1 className="page-title">Реестр оборудования</h1>

        {isCreateAllowed ? (
          <a className="equipment-add-button" href="#/equipment/create">
            <Plus aria-hidden="true" size={18} />
            <span>Добавить</span>
          </a>
        ) : null}
      </header>

      <section
        className="equipment-table-section"
        aria-label="Реестр оборудования"
      >
        <LoadingIndicator loading={isLoading}>
          Загрузка реестра...
        </LoadingIndicator>
        {error ? (
          <div className="equipment-state-message error">
            {error}
            <button
              type="button"
              className="admin-secondary-button"
              onClick={list.retry}
            >
              Повторить загрузку
            </button>
          </div>
        ) : null}
        {!isLoading && !error ? (
          <EquipmentRegistryTable
            items={items}
            onOpenEquipment={openEquipmentCard}
            sort={sort}
            onSortChange={(nextSort) => {
              setSort(nextSort);
            }}
          />
        ) : null}
        <ListLoadMore list={list} />
      </section>
    </div>
  );
}
