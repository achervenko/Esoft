import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import "../../shared/ui/PageActions.css";
import {
  ordersApi,
  orderTitle,
  type OrderChange,
} from "../../shared/api/orders-api";
import { formatBusinessDateTime } from "../../shared/lib/business-date";
import { Notice } from "../../shared/ui/Notice";
import { useOrdersQuery } from "./useOrders";
import { OrderStatus } from "../../shared/orders/OrderStatus";
const labels = {
  number: "Номер",
  name: "Название",
  documentDate: "Дата заказа",
  status: "Статус",
  posted: "Проведён",
  deletionMark: "Пометка удаления",
} as const;
function display(value: unknown, field: string) {
  if (typeof value === "boolean") return value ? "Да" : "Нет";
  if (field === "documentDate" && typeof value === "string")
    return `${value.slice(0, 10).split("-").reverse().join(".")} ${value.slice(11, 16)}`;
  return String(value || "Не указано");
}
function HistoryRow({ row }: { row: OrderChange }) {
  return (
    <li className="admin-card">
      <strong>{formatBusinessDateTime(row.observedAt)}</strong>
      {!row.before ? (
        <p>Заказ впервые получен из 1С. Статус: {row.after.status}.</p>
      ) : (
        <ul>
          {Boolean(row.before.missing) !== Boolean(row.after.missing) && (
            <li>
              {row.after.missing ? "Отсутствует в 1С" : "Снова получен из 1С"}
            </li>
          )}
          {Object.entries(labels)
            .filter(
              ([key]) =>
                row.before?.[key as keyof typeof labels] !==
                row.after[key as keyof typeof labels],
            )
            .map(([key, label]) => (
              <li key={key}>
                {label}:{" "}
                {display(row.before?.[key as keyof typeof labels], key)} →{" "}
                {display(row.after[key as keyof typeof labels], key)}
              </li>
            ))}
        </ul>
      )}
    </li>
  );
}
export function OrderDetails({ id }: { id: string }) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const query = useOrdersQuery((signal) => ordersApi.detail(id, signal), [id]);
  const row = query.data;
  return (
    <section className="admin-page orders-page">
      <a className="page-back-button orders-back-link" href="#/orders">
        <ArrowLeft size={18} aria-hidden="true" />
        Назад
      </a>
      {query.loading && <p role="status">Загрузка…</p>}
      {query.error && (
        <Notice tone="error">
          {query.error}
          <button className="admin-secondary-button" onClick={query.retry}>
            Повторить
          </button>
        </Notice>
      )}
      {row && (
        <>
          <header className="admin-page-header">
            <h1>{orderTitle(row)}</h1>
          </header>
          {row.missingChecks === 2 && <Notice>Отсутствует в 1С</Notice>}
          <dl className="admin-card orders-details">
            {Object.entries(labels)
              .filter(([key]) => key !== "deletionMark")
              .map(([key, label]) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>
                    {key === "status" ? (
                      <OrderStatus
                        status={row.status}
                        deleted={row.deletionMark}
                      />
                    ) : (
                      display(row[key as keyof typeof labels], key)
                    )}
                  </dd>
                </div>
              ))}
            <div>
              <dt>Источник</dt>
              <dd>{row.source.name}</dd>
            </div>
            <div>
              <dt>Проверен</dt>
              <dd>{formatBusinessDateTime(row.checkedAt)}</dd>
            </div>
            <div>
              <dt>Изменён в ESoft</dt>
              <dd>{formatBusinessDateTime(row.changedAt)}</dd>
            </div>
          </dl>
          <details
            className="admin-card orders-history-section"
            onToggle={(event) => setHistoryOpen(event.currentTarget.open)}
          >
            <summary>История изменений</summary>
            {historyOpen && <OrderHistory id={id} />}
          </details>
        </>
      )}
    </section>
  );
}

function OrderHistory({ id }: { id: string }) {
  const [page, setPage] = useState(1);
  const query = useOrdersQuery(
    (signal) => ordersApi.history(id, page, signal),
    [id, page],
  );
  return (
    <>
      {query.loading && <p role="status">Загрузка истории…</p>}
      {query.error && (
        <Notice tone="error">
          {query.error}
          <button className="admin-secondary-button" onClick={query.retry}>
            Повторить
          </button>
        </Notice>
      )}
      <ul className="orders-history">
        {query.data?.items.map((change) => (
          <HistoryRow row={change} key={change.id} />
        ))}
      </ul>
      {query.data && query.data.total > 20 && (
        <nav className="orders-pagination" aria-label="Страницы истории">
          <button
            className="admin-secondary-button"
            disabled={query.loading || page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Назад
          </button>
          <span>{page}</span>
          <button
            className="admin-secondary-button"
            disabled={query.loading || page * 20 >= query.data.total}
            onClick={() => setPage((p) => p + 1)}
          >
            Далее
          </button>
        </nav>
      )}
      {!query.loading && !query.error && query.data?.total === 0 && (
        <p>История изменений пуста.</p>
      )}
    </>
  );
}
