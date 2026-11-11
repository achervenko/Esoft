import { hasPermission } from "../../shared/lib/permissions";
import { ReservationOperationForm } from "./ReservationOperationForm";
import type { ReservationOperation } from "./reservation-operation";
import { useState } from "react";
import type { ReservationOrderSummary } from "../../shared/api/warehouse-reservations-api";
import { AdminModal } from "../../shared/ui/AdminModal";
import { CheckboxFilterModal } from "../../shared/ui/CheckboxFilterModal";
import { SearchToolbar } from "../../shared/ui/SearchToolbar";
import { Notice } from "../../shared/ui/Notice";
import { OrderStatus } from "../../shared/orders/OrderStatus";
import { useReservationOrder } from "./useReservationOrder";
import { ReservationItemsList } from "./ReservationItemsList";
import "./ReservationOrderModal.css";

export function ReservationOrderModal({
  order,
  onClose,
  permissions = [],
  onChanged,
}: {
  order: ReservationOrderSummary["order"];
  onClose: () => void;
  permissions?: readonly string[] | null;
  onChanged?: () => void;
}) {
  const query = useReservationOrder(order.id);
  const [operation, setOperation] = useState<ReservationOperation | null>(null);
  const canManage = hasPermission(permissions, "warehouse.reservations.manage");
  const refresh = () => {
    query.refresh();
    onChanged?.();
  };

  const { summary, error, retry, list } = query;
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const toggle = (id: string) =>
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <AdminModal
      className="reservation-order-modal"
      title={`Заказ №${summary?.order.number ?? order.number}`}
      onClose={onClose}
    >
      <div className="reservation-modal-body">
        <div className="reservation-modal-top">
          <div className="reservation-modal-order">
            <div>
              {(summary?.order.name ?? order.name) && (
                <strong>{summary?.order.name ?? order.name}</strong>
              )}
            </div>
            <OrderStatus status={summary?.order.status ?? order.status} />
          </div>
          {canManage && (
            <button
              type="button"
              className="admin-secondary-button"

              onClick={() => setOperation({ kind: "reserve" })}
            >
              Добавить резерв
            </button>
          )}
          <SearchToolbar
            value={query.search}
            onChange={query.setSearch}
            label="Поиск по наименованию или артикулу"
            inputProps={{ maxLength: 255 }}
            filters={{
              label: "Настройки поиска номенклатуры",
              count: Number(query.deficitOnly),
              expanded: filtersOpen,
              onOpen: () => setFiltersOpen(true),
            }}
          />
        </div>
        {summary && error && (
          <Notice tone="error">
            {error}
            <button type="button" onClick={retry}>
              Повторить загрузку заказа
            </button>
          </Notice>
        )}
        {!summary ? (
          <div className="reservation-modal-scroll">
            {error ? (
              <Notice tone="error">
                {error}
                <button
                  type="button"
                  className="admin-secondary-button"
                  onClick={retry}
                >
                  Повторить
                </button>
              </Notice>
            ) : (
              <p role="status">Загрузка заказа…</p>
            )}
          </div>
        ) : (
          <ReservationItemsList
            key={query.queryKey}
            permissions={permissions}
            onOperation={setOperation}
            list={list}
            expanded={expanded}
            onToggle={toggle}
            filtered={!!query.search.trim() || query.deficitOnly}
          />
        )}
        <div className="reservation-modal-bottom" aria-hidden="true" />
      </div>
      {operation && (
        <ReservationOperationForm
          key={JSON.stringify(operation)}
          operation={operation}
          orderId={order.id}
          onClose={() => setOperation(null)}
          onSaved={() => {
            setOperation(null);
            refresh();
          }}
          onRefresh={() => {
            setOperation(null);
            refresh();
          }}
        />
      )}
      {filtersOpen && (
        <CheckboxFilterModal
          title="Настройки поиска"
          legend="Обеспеченность"
          allowEmpty
          options={[{ value: "DEFICIT", label: "Только с дефицитом" }]}
          values={query.deficitOnly ? ["DEFICIT"] : []}
          onApply={(values) => {
            query.setDeficitOnly(values.includes("DEFICIT"));
            setFiltersOpen(false);
          }}
          onClose={() => setFiltersOpen(false)}
        />
      )}
    </AdminModal>
  );
}
