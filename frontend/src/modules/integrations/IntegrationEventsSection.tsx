import type { Dispatch, SetStateAction } from "react";
import {
  receiptIntegrationApi,
  type ReceiptEvent,
} from "../../shared/api/receipt-integration-api";
import { SelectField } from "../../shared/ui/SelectField";
import { DataTable } from "../../shared/ui/DataTable";
import { formatBusinessDateTime } from "../../shared/lib/business-date";
export function IntegrationEventsSection({
  events,
  status,
  setStatus,
  page,
  setPage,
  busy,
  loading,
  mutate,
  reload,
}: {
  events: { items: ReceiptEvent[]; total: number };
  status: string;
  setStatus: (status: string) => void;
  page: number;
  setPage: Dispatch<SetStateAction<number>>;
  busy: boolean;
  loading: boolean;
  mutate: (run: () => Promise<unknown>) => Promise<void>;
  reload: () => void;
}) {
  return (
    <section className="admin-card">
      <header className="admin-page-header">
        <h3>Журнал событий</h3>
        <button
          className="admin-secondary-button"
          onClick={reload}
          disabled={busy || loading}
        >
          Обновить
        </button>
      </header>
      <SelectField
        label="Состояние событий"
        value={status}
        onChange={(v) => {
          setStatus(v);
          setPage(1);
        }}
        options={[
          { value: "", label: "Все" },
          { value: "PENDING", label: "Ожидают" },
          { value: "PROCESSING", label: "В обработке" },
          { value: "PROCESSED", label: "Обработаны" },
          { value: "SKIPPED", label: "Пропущены" },
          { value: "FAILED", label: "Ошибка" },
        ]}
      />
      <DataTable
        rows={events.items}
        getRowKey={(e) => e.id}
        defaultSort={{ key: "id", direction: "desc" }}
        serverSorted
        columns={[
          {
            key: "id",
            label: "Событие",
            isSortable: false,
            render: (e) => (
              <>
                {e.sourceName}
                <small>
                  {e.resultSummary?.documentNumber ?? e.objectId}
                  {e.version !== "0" &&
                    ` · v${e.resultSummary?.documentVersion ?? e.version}`}
                  {e.resultSummary?.warehouseName &&
                    ` · ${e.resultSummary.warehouseName}`}
                </small>
              </>
            ),
          },
          {
            key: "state",
            label: "Состояние",
            isSortable: false,
            render: (e) =>
              ({
                PENDING: "Ожидает",
                PROCESSING: "В обработке",
                PROCESSED: "Обработано",
                SKIPPED: "Пропущено",
                FAILED: "Ошибка",
              })[e.status] ?? e.status,
          },
          {
            key: "attempts",
            label: "Попытки",
            isSortable: false,
            render: (e) => e.attempts,
          },
          {
            key: "error",
            label: "Последняя ошибка",
            isSortable: false,
            render: (e) =>
              e.resultCode === "ONE_C_WAREHOUSE_UNMAPPED"
                ? "Склад не подключён"
                : e.resultCode === "ONE_C_WAREHOUSE_INACTIVE"
                  ? "Склад выключен"
                  : (e.lastErrorCode ??
                    (e.status === "PROCESSED"
                      ? "—"
                      : e.status === "PROCESSING"
                        ? "В обработке"
                        : "Ожидает обработки")),
          },
          {
            key: "next",
            label: "Следующая попытка",
            isSortable: false,
            render: (e) =>
              e.status === "PENDING"
                ? formatBusinessDateTime(e.nextAttemptAt)
                : "—",
          },
          {
            key: "actions",
            label: "",
            isSortable: false,
            render: (e) => (
              <button
                className="admin-secondary-button"
                disabled={busy || !["FAILED", "SKIPPED"].includes(e.status)}
                onClick={() =>
                  void mutate(() => receiptIntegrationApi.retry(e.id))
                }
              >
                Повторить
              </button>
            ),
          },
        ]}
      />
      <div className="admin-form-actions">
        <button
          className="admin-secondary-button"
          disabled={page === 1 || loading}
          onClick={() => setPage((p) => p - 1)}
        >
          Назад
        </button>
        <span>Всего: {events.total}</span>
        <button
          className="admin-secondary-button"
          disabled={page * 25 >= events.total || loading}
          onClick={() => setPage((p) => p + 1)}
        >
          Далее
        </button>
      </div>
    </section>
  );
}
