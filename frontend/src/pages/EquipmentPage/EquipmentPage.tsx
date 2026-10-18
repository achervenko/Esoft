import { LoadingIndicator } from "../../shared/ui/LoadingIndicator";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { canCreateEquipment } from "../../modules/equipment-permissions";
import { getApiErrorMessage } from "../../shared/api/api-error";
import { getEquipmentRegistry } from "../../shared/api/equipment/equipment.api";
import type { EquipmentRegistryItem } from "../../shared/api/equipment/equipment.types";
import { buildHashRoute } from "../../shared/lib/hash-navigation";
import { useNotifications } from "../../shared/ui/notifications";
import { EquipmentRegistryTable, type EquipmentSortKey } from "./EquipmentRegistryTable";
import { PageNavigation } from "../../shared/ui/PageNavigation";
import type { DataTableSortDirection } from "../../shared/ui/DataTable";
import "./EquipmentPage.css";

type EquipmentPageProps = {
  userPermissions: readonly string[] | null;
};

export function EquipmentPage({ userPermissions }: EquipmentPageProps) {
  const { notifyError } = useNotifications();
  const isCreateAllowed = canCreateEquipment(userPermissions);
  const [items, setItems] = useState<EquipmentRegistryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState<{ key: EquipmentSortKey; direction: DataTableSortDirection }>({ key: 'visibleId', direction: 'asc' });

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    setItems([]);

    getEquipmentRegistry({ page: page + 1, sort: sort.key, direction: sort.direction }, controller.signal)
      .then((data) => {
        if (isMounted) {
          if (page > 0 && page * 100 >= data.total) {
            setPage(Math.max(0, Math.ceil(data.total / 100) - 1));
            return;
          }
          setItems(data.items);
          setTotal(data.total);
        }
      })
      .catch((requestError) => {
        if (isMounted) {
          const errorMessage = getApiErrorMessage(requestError);
          setError(errorMessage);
          notifyError("Не удалось загрузить оборудование", errorMessage);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [notifyError, page, sort]);

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
        <LoadingIndicator loading={isLoading}>Загрузка реестра...</LoadingIndicator>
        {error ? (
          <p className="equipment-state-message error">{error}</p>
        ) : null}
        {!isLoading && !error ? (
          <EquipmentRegistryTable
            items={items}
            onOpenEquipment={openEquipmentCard}
            sort={sort}
            onSortChange={(nextSort) => { setSort(nextSort); setPage(0); }}
          />
        ) : null}
        {!error ? <PageNavigation page={page} pageSize={100} total={total} loading={isLoading} onChange={setPage} /> : null}
      </section>
    </div>
  );
}
