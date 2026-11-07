import { useEffect, useState } from "react";
import { ordersApi, type OrderData } from "../../shared/api/orders-api";
import { hasPermission } from "../../shared/lib/permissions";
import { SearchToolbar } from "../../shared/ui/SearchToolbar";
import { AdminModal } from "../../shared/ui/AdminModal";
import { SelectField } from "../../shared/ui/SelectField";
import { Notice } from "../../shared/ui/Notice";
import { useOrdersQuery } from "./useOrders";
import { OrderDetails } from "./OrderDetails";
import { OrdersListCards } from "./OrdersListCards";
import { useIncrementalList } from "../../shared/lib/useIncrementalList";
import { ListLoadMore } from "../../shared/ui/ListLoadMore";
import "../../shared/ui/AdminPage.css";
import "./OrdersPage.css";
export function OrdersPage({
  userPermissions,
  orderId,
}: {
  userPermissions: readonly string[] | null;
  orderId?: string;
}) {
  if (!hasPermission(userPermissions, "orders.read"))
    return (
      <Notice tone="error">Недостаточно прав для просмотра заказов.</Notice>
    );
  return orderId ? <OrderDetails key={orderId} id={orderId} /> : <OrdersList />;
}
function OrdersList() {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState(""),
    [debounced, setDebounced] = useState("");
  const [statuses, setStatuses] = useState<string[]>([]),
    [sourceId, setSourceId] = useState("");
  const [deleted, setDeleted] = useState("false");
  const [availableStatuses, setAvailableStatuses] = useState<string[]>([]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const sources = useOrdersQuery((signal) => ordersApi.sources(signal), []);
  const query = useIncrementalList<OrderData, { statuses: string[] }>({
    queryKey: JSON.stringify([debounced, statuses, sourceId, deleted]),
    enabled: true,
    getKey: (row) => row.id,
    loadPage: async (offset, signal) => {
      const params = new URLSearchParams({
        page: String(offset / 50 + 1),
        limit: "50",
        deleted,
      });
      if (debounced) params.set("search", debounced);
      if (statuses.length) params.set("statuses", JSON.stringify(statuses));
      if (sourceId) params.set("sourceId", sourceId);
      const result = await ordersApi.list(params, signal);
      if (!signal.aborted) setAvailableStatuses(result.statuses);
      return result;
    },
  });
  return (
    <section className="admin-page orders-page">
      <header className="admin-page-header">
        <h1>Заказы</h1>
      </header>
      <SearchToolbar
        value={search}
        onChange={setSearch}
        label="Поиск заказов по номеру и названию"
        inputProps={{ maxLength: 255 }}
        filters={{
          label: "Фильтры заказов",
          count:
            Number(statuses.length > 0) +
            Number(Boolean(sourceId)) +
            Number(deleted !== "false"),
          onOpen: () => setFiltersOpen(true),
          expanded: filtersOpen,
        }}
      />
      {filtersOpen && (
        <AdminModal
          title="Настройки поиска"
          onClose={() => setFiltersOpen(false)}
        >
          <div className="admin-form">
            <SelectField
              label="Статус"
              multiple
              placeholder="Все статусы"
              value={statuses}
              onChange={(value) => {
                setStatuses(value);
              }}
              options={availableStatuses.map((status) => ({
                value: status,
                label: status,
              }))}
            />
            {(sources.data?.length ?? 0) > 1 && (
              <SelectField
                label="Источник"
                value={sourceId}
                onChange={(v) => {
                  setSourceId(v);
                }}
                options={[
                  { value: "", label: "Все источники" },
                  ...(sources.data ?? []).map((s) => ({
                    value: s.id,
                    label: s.name,
                  })),
                ]}
              />
            )}
            <SelectField
              label="Удалённые в 1С"
              value={deleted}
              onChange={(value) => {
                setDeleted(value);
              }}
              options={[
                { value: "all", label: "Все" },
                { value: "true", label: "Удалённые" },
                { value: "false", label: "Не удалённые" },
              ]}
            />
            <div className="admin-form-actions">
              <button
                type="button"
                className="admin-secondary-button"
                onClick={() => {
                  setStatuses([]);
                  setDeleted("false");
                  setSourceId("");
                }}
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
      {sources.error && (
        <Notice tone="error">
          {sources.error}
          <button className="admin-secondary-button" onClick={sources.retry}>
            Повторить
          </button>
        </Notice>
      )}
      {query.error && !query.data && (
        <Notice tone="error">
          {query.error}
          <button className="admin-secondary-button" onClick={query.retry}>
            Повторить
          </button>
        </Notice>
      )}
      {query.loading && !query.data && <p role="status">Загрузка…</p>}
      <OrdersListCards
        items={query.data?.items ?? []}
        loading={query.loading}
      />
      <ListLoadMore list={query} disabled={filtersOpen} />
      {!query.loading && !query.error && query.data && !query.data.total && (
        <p>Заказы не найдены.</p>
      )}
    </section>
  );
}
