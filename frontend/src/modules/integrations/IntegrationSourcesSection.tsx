import { useState } from "react";
import { Edit2, Link2, Plus } from "lucide-react";
import type {
  ReceiptSource,
  IntegrationFlowRegistration,
} from "../../shared/api/receipt-integration-api";
import { ReceiptSourceForm } from "./ReceiptSourceForm";
import { IntegrationWarehousesDialog } from "./IntegrationWarehousesDialog";
import { DataTable } from "../../shared/ui/DataTable";
import { IntegrationFlowStatus } from "./IntegrationFlowStatus";
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
  const flowName = (code: string) =>
    availableFlows.find((flow) => flow.flowCode === code)?.name ?? code;
  return (
    <>
      <section className="admin-card">
        <header>
          <h2>1С</h2>
          <button
            type="button"
            className="admin-primary-button"
            onClick={() => setEditing("new")}
          >
            <Plus size={18} aria-hidden="true" />
            Добавить
          </button>
        </header>
        <DataTable
          rows={sources}
          getRowKey={(s) => s.code}
          getRowClassName={(s) => (s.isActive ? undefined : "inactive-surface")}
          defaultSort={{ key: "source", direction: "asc" }}
          serverSorted
          columns={[
            {
              key: "source",
              label: "Источник",
              isSortable: false,
              render: (s) =>
                s.isActive ? (
                  s.name
                ) : (
                  <span title="Обмен выключен">{s.name}</span>
                ),
            },
            {
              key: "usage",
              label: "Назначение",
              isSortable: false,
              render: (s) =>
                s.flows.length ? (
                  <div className="integration-flow-statuses">
                    {s.flows.map(({ flowCode }) => (
                      <div key={flowCode}>{flowName(flowCode)}</div>
                    ))}
                  </div>
                ) : (
                  "Не подключены"
                ),
            },
            {
              key: "status",
              label: "Статус",
              isSortable: false,
              render: (s) =>
                s.isActive && s.flows.length > 0 ? (
                  <div className="integration-flow-statuses">
                    {s.flows.map((flow) => (
                      <div key={flow.flowCode}>
                        <IntegrationFlowStatus
                          flow={flow}
                          name={flowName(flow.flowCode)}
                        />
                      </div>
                    ))}
                  </div>
                ) : null,
            },
            {
              key: "actions",
              label: "",
              isSortable: false,
              render: (s) => (
                <div className="admin-table-actions">
                  <button
                    type="button"
                    className="admin-icon-button"
                    aria-label="Настроить"
                    title="Настроить"
                    onClick={() => setEditing(s)}
                  >
                    <Edit2 size={17} aria-hidden="true" />
                  </button>
                  {s.flows.some((f) => f.flowCode === "warehouse.receipts") && (
                    <button
                      type="button"
                      className="admin-icon-button"
                      aria-label="Сопоставление складов"
                      title="Сопоставление складов"
                      onClick={() => setWarehouseSource(s.code)}
                    >
                      <Link2 size={17} aria-hidden="true" />
                    </button>
                  )}
                </div>
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
