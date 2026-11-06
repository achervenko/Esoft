import { useRef, useState } from "react";
import {
  receiptIntegrationApi,
  type ReceiptSource,
  type IntegrationFlowRegistration,
  type IntegrationFlow,
} from "../../shared/api/receipt-integration-api";
import { getApiErrorMessage } from "../../shared/api/api-error";
import { AdminModal } from "../../shared/ui/AdminModal";
import {
  AdminFormActions,
  AdminTextField as TextField,
} from "../../shared/ui/AdminFormControls";
import { SelectField } from "../../shared/ui/SelectField";
import { Switch } from "../../shared/ui/Switch";
import { Notice } from "../../shared/ui/Notice";

export function ReceiptSourceForm({
  source,
  availableFlows,
  onClose,
  onSaved,
}: {
  source: ReceiptSource | null;
  availableFlows: IntegrationFlowRegistration[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(source?.name ?? "");
  const [selectedFlows, setSelectedFlows] = useState(
    source?.flows.filter((f) => f.isActive).map((f) => f.flowCode) ??
      availableFlows
        .filter((f) => f.systemTypes.includes("ONE_C"))
        .map((f) => f.flowCode),
  );
  const [baseUrl, setUrl] = useState(source?.baseUrl ?? "");
  const [authorization, setAuthorization] = useState("");
  const [active, setActive] = useState(source?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef(false);
  return (
    <AdminModal
      title={source ? "Настройки источника" : "Новый источник 1С"}
      onClose={onClose}
      isCloseDisabled={saving}
    >
      <form
        className="admin-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (ref.current) return;
          ref.current = true;
          setSaving(true);
          setError(null);
          try {
            await receiptIntegrationApi.configure({
              code: source?.code,
              name: name.trim(),
              flows: [
                ...new Set([
                  ...selectedFlows,
                  ...(source?.flows.map((f) => f.flowCode) ?? []),
                ]),
              ].map(
                (flowCode) =>
                  ({
                    ...(source?.flows.find((f) => f.flowCode === flowCode) ?? {
                      flowCode,
                      configVersion: 1,
                      config: {},
                      lastSuccessAt: null,
                      lastErrorAt: null,
                      lastErrorCode: null,
                    }),
                    isActive: selectedFlows.includes(flowCode),
                  }) satisfies IntegrationFlow,
              ),
              baseUrl: baseUrl.trim(),
              authorization,
              isActive: active,
            });
            setAuthorization("");
            onSaved();
          } catch (err) {
            setError(getApiErrorMessage(err));
          } finally {
            ref.current = false;
            setSaving(false);
          }
        }}
      >
        <fieldset
          disabled={saving}
          className="admin-form receipt-integration-fields"
        >
          <TextField
            label="Название обмена"
            required
            value={name}
            onChange={setName}
            maxLength={100}
          />
          <TextField
            label="Базовый URL HTTP-сервиса 1С"
            required
            type="url"
            value={baseUrl}
            onChange={setUrl}
            maxLength={2000}
          />
          <TextField
            label="Authorization для доступа ESoft к 1С"
            required={!source}
            type="password"
            value={authorization}
            onChange={setAuthorization}
            autoComplete="new-password"
            maxLength={2000}
          />
          <Notice>
            Введите полное значение, например Bearer …. При редактировании
            оставьте поле пустым, чтобы сохранить действующие данные доступа.
            Сохранённый секрет обратно не загружается.
          </Notice>
          <SelectField
            label="Обмены"
            multiple
            value={selectedFlows}
            onChange={setSelectedFlows}
            placeholder="Нет подключённых обменов"
            options={availableFlows
              .filter((f) => f.systemTypes.includes("ONE_C"))
              .map((f) => ({ value: f.flowCode, label: f.name }))}
          />
          <label>
            Обмен включён{" "}
            <Switch
              label="Обмен включён"
              checked={active}
              onChange={setActive}
            />
          </label>
        </fieldset>
        {error && <Notice tone="error">{error}</Notice>}
        <AdminFormActions
          isSaving={saving}
          onClose={onClose}
          submitDisabled={
            !name.trim() ||
            !baseUrl.trim() ||
            (!source && !authorization.trim())
          }
        />
      </form>
    </AdminModal>
  );
}
