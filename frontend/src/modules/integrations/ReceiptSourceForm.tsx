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
        .filter(
          (f) =>
            f.systemTypes.includes("ONE_C") && f.incomingActions.length > 0,
        )
        .map((f) => f.flowCode),
  );
  const [baseUrl, setUrl] = useState(source?.baseUrl ?? "");
  const [authMode, setAuthMode] = useState("header");
  const [authorization, setAuthorization] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [active, setActive] = useState(source?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef(false);
  const basic = authMode === "basic";
  const hasBasicInput = login !== "" || password !== "";
  let accessHeader = authorization.trim();
  if (basic) {
    accessHeader = "";
    if (login.trim() && !login.includes(":") && password) {
      const bytes = new TextEncoder().encode(`${login}:${password}`);
      accessHeader = `Basic ${btoa(String.fromCharCode(...bytes))}`;
    }
  }
  const invalidCredentials =
    accessHeader.length > 2000 ||
    (!accessHeader && (!source || (basic && hasBasicInput)));
  const submitDisabled = !name.trim() || !baseUrl.trim() || invalidCredentials;
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
          if (ref.current || submitDisabled) return;
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
              authorization: accessHeader,
              isActive: active,
            });
            setAuthorization("");
            setLogin("");
            setPassword("");
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
            label="Базовый адрес 1С"
            required
            type="url"
            value={baseUrl}
            onChange={setUrl}
            maxLength={2000}
          />
          <SelectField
            label="Способ входа в 1С"
            value={authMode}
            onChange={(mode) => {
              setAuthMode(mode);
              setAuthorization("");
              setLogin("");
              setPassword("");
              setError(null);
            }}
            options={[
              { value: "basic", label: "Логин и пароль (Basic)" },
              { value: "header", label: "Заголовок Authorization" },
            ]}
          />
          {basic ? (
            <>
              <TextField
                label="Логин 1С"
                value={login}
                onChange={setLogin}
                required={!source || hasBasicInput}
                autoComplete="off"
                maxLength={1500}
                error={
                  login.includes(":")
                    ? "Логин не может содержать двоеточие."
                    : undefined
                }
              />
              <TextField
                label="Пароль 1С"
                type="password"
                value={password}
                onChange={setPassword}
                required={!source || hasBasicInput}
                autoComplete="new-password"
                maxLength={1500}
                error={
                  accessHeader.length > 2000
                    ? "Логин и пароль слишком длинные."
                    : undefined
                }
              />
            </>
          ) : (
            <TextField
              label="Authorization для доступа ESoft к 1С"
              required={!source}
              type="password"
              value={authorization}
              onChange={setAuthorization}
              autoComplete="new-password"
              maxLength={2000}
            />
          )}
          {source && (
            <Notice>
              Оставьте поля доступа пустыми, чтобы сохранить текущие данные.
            </Notice>
          )}
          {!basic && (
            <Notice>Введите заголовок целиком, например Bearer …</Notice>
          )}
          {/^http:\/\//i.test(baseUrl.trim()) && (
            <Notice>
              При подключении к 1С по HTTP данные доступа передаются без
              шифрования. Используйте HTTPS, если он настроен на сервере 1С.
            </Notice>
          )}
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
          submitDisabled={submitDisabled}
        />
      </form>
    </AdminModal>
  );
}
