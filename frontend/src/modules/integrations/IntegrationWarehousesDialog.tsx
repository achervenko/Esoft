import { useEffect, useRef, useState } from "react";
import {
  receiptIntegrationWarehousesApi as api,
  type ReceiptWarehouseLinks,
} from "../../shared/api/receipt-integration-warehouses-api";
import { getApiErrorMessage } from "../../shared/api/api-error";
import { AdminModal } from "../../shared/ui/AdminModal";
import { SelectDropdown } from "../../shared/ui/SelectDropdown";
import "../../shared/ui/SelectField.css";
import { Notice } from "../../shared/ui/Notice";
import { DataTable } from "../../shared/ui/DataTable";
import "./IntegrationWarehousesDialog.css";

export function IntegrationWarehousesDialog({
  code,
  onClose,
}: {
  code: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<ReceiptWarehouseLinks>({
    observed: [],
    links: [],
    warehouses: [],
  });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    api
      .list(code, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(getApiErrorMessage(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [code, revision]);
  const rows = new Map(
    (data.observed ?? []).map(({ externalId, name }) => [
      externalId,
      {
        externalId,
        name,
        link: undefined as ReceiptWarehouseLinks["links"][number] | undefined,
      },
    ]),
  );
  for (const link of data.links) {
    const id = link.externalId;
    const observed = rows.get(id);
    rows.set(id, {
      externalId: id,
      name: observed?.name ?? "",
      link,
    });
  }
  const options = data.warehouses.map(({ id, name }) => ({
    value: id,
    label: name,
  }));

  const changes = [...rows.values()].filter(
    ({ externalId, link }) => !link && drafts[externalId],
  );

  async function save() {
    if (submitting.current || loading || !changes.length) return;
    submitting.current = true;
    setSaving(true);
    setError(null);
    try {
      for (const { externalId } of changes) {
        await api.save(code, { externalId, warehouseId: drafts[externalId] });
        const warehouseId = drafts[externalId];
        const warehouseName =
          options.find(({ value }) => value === warehouseId)?.label ?? "";
        setData((current) => ({
          ...current,
          links: [
            ...current.links,
            { externalId, warehouseId, warehouseName, isActive: true },
          ],
        }));
        setDrafts((current) => ({ ...current, [externalId]: "" }));
      }
      setRevision((r) => r + 1);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  return (
    <AdminModal
      className="integration-warehouses-dialog"
      title="Склады обмена с 1С"
      onClose={onClose}
      isCloseDisabled={saving}
    >
      <div className="admin-form integration-warehouses-body">
        <div className="integration-warehouses-table">
          <DataTable
            defaultSort={{ key: "externalId", direction: "asc" }}
            serverSorted
            rows={[...rows.values()]}
            getRowClassName={(row) =>
              row.link ? "integration-warehouse-linked" : undefined
            }
            getRowKey={(row) => row.externalId}
            columns={[
              {
                key: "externalId",
                label: "Идентификатор склада 1С",
                isSortable: false,
                render: (row) => row.externalId,
              },
              {
                key: "name",
                label: "Название в 1С",
                isSortable: false,
                render: (row) => row.name || "—",
              },
              {
                key: "warehouse",
                label: "Склад ESoft",
                isSortable: false,
                render: (row) =>
                  row.link ? (
                    <span title="Сопоставлен">
                      {row.link.warehouseName}
                      {!row.link.isActive && " (выключен)"}
                    </span>
                  ) : (
                    <SelectDropdown
                      className="select-field"
                      menuClassName="select-field-menu"
                      aria-label={`Склад ESoft для ${row.name || row.externalId}`}
                      placeholder="Выбрать склад"
                      value={drafts[row.externalId] ?? ""}
                      onChange={(value) =>
                        setDrafts((current) => ({
                          ...current,
                          [row.externalId]: value,
                        }))
                      }
                      options={options}
                      disabled={saving || loading}
                    />
                  ),
              },
            ]}
          />
        </div>
        {loading && <p>Загрузка…</p>}
        {error && (
          <Notice tone="error">
            {error}
            <button
              type="button"
              disabled={saving}
              onClick={() => setRevision((r) => r + 1)}
            >
              Повторить загрузку
            </button>
          </Notice>
        )}
        {(changes.length > 0 || saving) && (
          <div className="admin-form-actions">
            <button
              type="button"
              className="admin-primary-button"
              disabled={saving || loading}
              onClick={() => void save()}
            >
              {saving ? "Сохранение…" : "Сохранить"}
            </button>
          </div>
        )}
      </div>
    </AdminModal>
  );
}
