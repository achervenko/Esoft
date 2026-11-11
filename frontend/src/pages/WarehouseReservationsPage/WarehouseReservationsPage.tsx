import { useState } from "react";
import { hasPermission } from "../../shared/lib/permissions";
import { AdminModal } from "../../shared/ui/AdminModal";
import { Notice } from "../../shared/ui/Notice";
import { SearchToolbar } from "../../shared/ui/SearchToolbar";
import { SelectField } from "../../shared/ui/SelectField";
import { ListLoadMore } from "../../shared/ui/ListLoadMore";
import { ReservationOrdersTable } from "./ReservationOrdersTable";
import { useReservationOrders } from "./useReservationOrders";
import { ReservationOrderModal } from "./ReservationOrderModal";
import type { ReservationOrderSummary } from "../../shared/api/warehouse-reservations-api";
import "../../shared/ui/AdminPage.css";
import "./WarehouseReservationsPage.css";

export function WarehouseReservationsPage({
  userPermissions,
}: {
  userPermissions: readonly string[] | null;
}) {
  const enabled = hasPermission(userPermissions, "warehouse.reservations.read");
  const page = useReservationOrders(enabled);
  const [selectedOrder, setSelectedOrder] =
    useState<ReservationOrderSummary | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { list } = page;
  if (!enabled)
    return (
      <section className="admin-page">
        <Notice tone="error">Недостаточно прав для просмотра резервов.</Notice>
      </section>
    );
  return (
    <section className="admin-page warehouse-reservations-page">
      <header className="admin-page-header">
        <h1>Резервы</h1>
      </header>
      <SearchToolbar
        value={page.search}
        onChange={page.setSearch}
        label="Поиск по заказу, артикулу и наименованию товара"
        inputProps={{ maxLength: 255 }}
        filters={{
          label: "Настройки поиска резервов",
          count: Number(page.coverage !== "ALL"),
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
              label="Обеспеченность"
              value={page.coverage}
              onChange={page.setCoverage}
              options={[
                { value: "ALL", label: "Все" },
                { value: "DEFICIT", label: "С дефицитом" },
                { value: "COVERED", label: "Полностью обеспеченные" },
              ]}
            />
            <div className="admin-form-actions">
              <button
                type="button"
                className="admin-secondary-button"
                disabled={page.coverage === "ALL"}
                onClick={() => page.setCoverage("ALL")}
              >
                Сбросить
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
      <section className="reservation-orders-surface" aria-busy={list.loading}>
        {list.error && (
          <Notice tone="error">
            {list.error}
            <button
              type="button"
              className="admin-secondary-button"
              onClick={list.retry}
            >
              Повторить загрузку
            </button>
          </Notice>
        )}
        {list.loading && !list.data && (
          <p className="admin-state" role="status">
            Загрузка…
          </p>
        )}
        {list.data && list.data.items.length > 0 && (
          <ReservationOrdersTable
            items={list.data.items}
            onOpen={setSelectedOrder}
          />
        )}
        {!list.loading && !list.error && list.data?.items.length === 0 && (
          <p className="admin-state">
            {page.search.trim() || page.coverage !== "ALL"
              ? "По заданным условиям резервы не найдены."
              : "Заказов с резервами пока нет."}
          </p>
        )}
        <ListLoadMore list={list} />
      </section>
      {selectedOrder && (
        <ReservationOrderModal
          key={selectedOrder.order.id}
          permissions={userPermissions}
          onChanged={page.refresh}
          order={selectedOrder.order}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </section>
  );
}
