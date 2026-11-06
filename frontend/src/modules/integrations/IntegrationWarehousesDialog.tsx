import { useEffect, useRef, useState } from "react";
import {
  receiptIntegrationWarehousesApi as api,
  type ReceiptWarehouseLinks,
} from "../../shared/api/receipt-integration-warehouses-api";
import { getApiErrorMessage } from "../../shared/api/api-error";
import { AdminModal } from "../../shared/ui/AdminModal";
import {
  AdminFormActions,
  AdminTextField,
} from "../../shared/ui/AdminFormControls";
import { SelectField } from "../../shared/ui/SelectField";
import { Notice } from "../../shared/ui/Notice";
import { DataTable } from "../../shared/ui/DataTable";

export function IntegrationWarehousesDialog({
  code,
  onClose,
}: {
  code: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<ReceiptWarehouseLinks>({
    links: [],
    warehouses: [],
  });
  const [externalId, setExternalId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
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
  return (
    <AdminModal
      title="Склады обмена с 1С"
      onClose={onClose}
      isCloseDisabled={saving}
    >
      <Notice>
        Укажите точный идентификатор склада из 1С и соответствующий склад ESoft
        до начала обмена. Неизвестные склады блокируют импорт. Сохранённую связь
        нельзя переназначить на другой склад; после настройки повторите
        ошибочное событие в журнале.
      </Notice>
      <DataTable
        defaultSort={{ key: "externalId", direction: "asc" }}
        serverSorted
        rows={data.links}
        getRowKey={(row) => row.externalId}
        columns={[
          {
            key: "externalId",
            label: "Идентификатор склада 1С",
            isSortable: false,
            render: (row) => row.externalId,
          },
          {
            key: "warehouse",
            label: "Склад ESoft",
            isSortable: false,
            render: (row) =>
              `${row.warehouseName}${row.isActive ? "" : " (выключен)"}`,
          },
        ]}
      />
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
      <form
        className="admin-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (submitting.current || loading) return;
          submitting.current = true;
          setSaving(true);
          setError(null);
          try {
            await api.save(code, {
              externalId: externalId.trim(),
              warehouseId,
            });
            setExternalId("");
            setWarehouseId("");
            setRevision((r) => r + 1);
          } catch (e) {
            setError(getApiErrorMessage(e));
          } finally {
            submitting.current = false;
            setSaving(false);
          }
        }}
      >
        <fieldset className="admin-form" disabled={saving || loading}>
          <AdminTextField
            label="Идентификатор склада 1С"
            value={externalId}
            onChange={setExternalId}
            maxLength={255}
            required
          />
          <SelectField
            label="Склад ESoft"
            value={warehouseId}
            onChange={setWarehouseId}
            options={data.warehouses.map((w) => ({
              value: w.id,
              label: w.name,
            }))}
          />
        </fieldset>
        <AdminFormActions
          isSaving={saving}
          onClose={onClose}
          submitDisabled={loading || !externalId.trim() || !warehouseId}
        />
      </form>
    </AdminModal>
  );
}
