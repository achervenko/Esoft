import { useState } from "react";
import { ReceiptKeyDialog } from "./ReceiptKeyDialog";
import {
  receiptIntegrationApi,
  type ReceiptSource,
  type ReceiptSourceKey,
  type IntegrationFlowRegistration,
} from "../../shared/api/receipt-integration-api";
import { API_URL } from "../../shared/api/api-config";
import { AdminTextField as TextField } from "../../shared/ui/AdminFormControls";
import { SelectField } from "../../shared/ui/SelectField";
import { useConfirmation } from "../../shared/ui/useConfirmation";
import { DataTable } from "../../shared/ui/DataTable";
import { formatBusinessDateTime } from "../../shared/lib/business-date";
export function IntegrationKeysSection({
  sources,
  availableFlows,
  keys,
  selected,
  setSelected,
  busy,
  mutate,
  reload,
}: {
  sources: ReceiptSource[];
  availableFlows: IntegrationFlowRegistration[];
  keys: ReceiptSourceKey[];
  selected: string;
  setSelected: (source: string) => void;
  busy: boolean;
  mutate: (run: () => Promise<unknown>) => Promise<void>;
  reload: () => void;
}) {
  const [issuingFor, setIssuingFor] = useState<string | null>(null);
  const confirm = useConfirmation();
  return (
    <>
      {issuingFor && (
        <ReceiptKeyDialog
          source={issuingFor}
          flows={(sources.find((s) => s.code === issuingFor)?.flows ?? [])
            .filter(
              (f) =>
                f.isActive &&
                availableFlows.some(
                  (a) =>
                    a.flowCode === f.flowCode &&
                    a.incomingActions.includes("event:create"),
                ),
            )
            .map((f) => ({
              value: f.flowCode,
              label:
                availableFlows.find((a) => a.flowCode === f.flowCode)?.name ??
                f.flowCode,
            }))}
          onClose={() => setIssuingFor(null)}
          onCreated={reload}
        />
      )}
      <section className="admin-card admin-form">
        <h3>Входящие API-ключи</h3>
        <SelectField
          label="Источник"
          value={selected}
          onChange={setSelected}
          placeholder=""
          options={sources.map((s) => ({
            value: s.code,
            label: s.name,
          }))}
        />
        {selected && (
          <>
            {(sources.find((s) => s.code === selected)?.flows ?? [])
              .filter(
                (f) =>
                  f.isActive &&
                  availableFlows.some(
                    (a) =>
                      a.flowCode === f.flowCode && a.incomingActions.length > 0,
                  ),
              )
              .map((flow) => (
                <TextField
                  key={flow.flowCode}
                  label={`Адрес событий — ${availableFlows.find((f) => f.flowCode === flow.flowCode)?.name ?? flow.flowCode}`}
                  value={`${API_URL}/api/integrations/sources/${encodeURIComponent(selected)}/flows/${encodeURIComponent(flow.flowCode)}/events`}
                  readOnly
                  onChange={() => {}}
                />
              ))}
            <button
              type="button"
              className="admin-primary-button"
              disabled={
                !sources
                  .find((s) => s.code === selected)
                  ?.flows.some(
                    (f) =>
                      f.isActive &&
                      availableFlows.some(
                        (a) =>
                          a.flowCode === f.flowCode &&
                          a.incomingActions.includes("event:create"),
                      ),
                  )
              }
              onClick={() => setIssuingFor(selected)}
            >
              Выпустить ключ
            </button>
            <DataTable
              rows={keys}
              getRowKey={(k) => k.id}
              defaultSort={{ key: "name", direction: "asc" }}
              serverSorted
              columns={[
                {
                  key: "name",
                  label: "Название",
                  isSortable: false,
                  render: (k) => k.name ?? "Без названия",
                },
                {
                  key: "created",
                  label: "Создан",
                  isSortable: false,
                  render: (k) => formatBusinessDateTime(k.createdAt),
                },
                {
                  key: "expires",
                  label: "Действует до",
                  isSortable: false,
                  render: (k) =>
                    k.expiresAt
                      ? formatBusinessDateTime(k.expiresAt)
                      : "Без срока",
                },
                {
                  key: "state",
                  label: "Статус",
                  isSortable: false,
                  render: (k) =>
                    !k.enabled
                      ? "Отозван"
                      : k.expiresAt && Date.parse(k.expiresAt) <= Date.now()
                        ? "Истёк"
                        : "Активен",
                },
                {
                  key: "actions",
                  label: "",
                  isSortable: false,
                  render: (k) => (
                    <button
                      className="admin-secondary-button"
                      disabled={busy || !k.enabled}
                      onClick={() => {
                        void (async () => {
                          if (
                            await confirm({
                              title: "Отозвать ключ?",
                              description:
                                "1С больше не сможет отправлять события с этим ключом.",
                              confirmLabel: "Отозвать",
                              variant: "danger",
                            })
                          )
                            await mutate(() =>
                              receiptIntegrationApi.revoke(selected, k.id),
                            );
                        })();
                      }}
                    >
                      Отозвать
                    </button>
                  ),
                },
              ]}
            />
          </>
        )}
      </section>
    </>
  );
}
