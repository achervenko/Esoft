import { useState } from "react";
import type {
  ReceiptSource,
  IntegrationFlowRegistration,
} from "../../shared/api/receipt-integration-api";
import { ReceiptSourceForm } from "./ReceiptSourceForm";
import { IntegrationWarehousesDialog } from "./IntegrationWarehousesDialog";
import { DataTable } from "../../shared/ui/DataTable";
import { formatBusinessDateTime } from "../../shared/lib/business-date";
export function IntegrationSourcesSection({
  sources,
  availableFlows,
  loading,
  reload,
}: {
  sources: ReceiptSource[];
  availableFlows: IntegrationFlowRegistration[];
  loading: boolean;
  reload: () => void;
}) {
  const [editing, setEditing] = useState<ReceiptSource | "new" | null>(null);
  const [warehouseSource, setWarehouseSource] = useState<string | null>(null);
  return (
    <>
      <header className="admin-page-header">
        <h3>1С</h3>
        <button
          className="admin-primary-button"
          onClick={() => setEditing("new")}
        >
          Добавить базу 1С
        </button>
      </header>
      <section className="admin-card">
        <DataTable
          rows={sources}
          getRowKey={(s) => s.code}
          defaultSort={{ key: "source", direction: "asc" }}
          serverSorted
          columns={[
            {
              key: "source",
              label: "Источник",
              isSortable: false,
              render: (s) => s.name,
            },
            {
              key: "address",
              label: "Сервис 1С",
              isSortable: false,
              render: (s) => s.baseUrl,
            },
            {
              key: "state",
              label: "Обмен",
              isSortable: false,
              render: (s) => (s.isActive ? "Включён" : "Выключен"),
            },
            {
              key: "usage",
              label: "Использование",
              isSortable: false,
              render: (s) =>
                s.flows
                  .map(
                    (f) =>
                      `${availableFlows.find((a) => a.flowCode === f.flowCode)?.name ?? f.flowCode}${f.isActive ? "" : " (выключен)"}`,
                  )
                  .join(", ") || "Не подключены",
            },
            {
              key: "lastSuccess",
              label: "Последняя обработка",
              isSortable: false,
              render: (s) => {
                const dates = s.flows
                  .map((f) => f.lastSuccessAt)
                  .filter((v): v is string => !!v)
                  .sort();
                return dates.length
                  ? formatBusinessDateTime(dates[dates.length - 1])
                  : "Ещё не было";
              },
            },
            {
              key: "actions",
              label: "",
              isSortable: false,
              render: (s) => (
                <>
                  <button
                    className="admin-secondary-button"
                    onClick={() => setEditing(s)}
                  >
                    Настроить
                  </button>
                  {s.flows.some((f) => f.flowCode === "warehouse.receipts") && (
                    <button
                      className="admin-secondary-button"
                      onClick={() => setWarehouseSource(s.code)}
                    >
                      Склады 1С
                    </button>
                  )}
                </>
              ),
            },
          ]}
        />
        {!loading && sources.length === 0 && (
          <p>Источники обмена не добавлены.</p>
        )}
      </section>
      {editing && (
        <ReceiptSourceForm
          source={editing === "new" ? null : editing}
          availableFlows={availableFlows}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
      {warehouseSource && (
        <IntegrationWarehousesDialog
          code={warehouseSource}
          onClose={() => setWarehouseSource(null)}
        />
      )}
    </>
  );
}
