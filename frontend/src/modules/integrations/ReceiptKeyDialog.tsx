import { useRef, useState } from "react";
import { receiptIntegrationApi } from "../../shared/api/receipt-integration-api";
import { getApiErrorMessage } from "../../shared/api/api-error";
import { AdminModal } from "../../shared/ui/AdminModal";
import { TextField } from "../../shared/ui/TextField";
import { SelectField } from "../../shared/ui/SelectField";
import { Notice } from "../../shared/ui/Notice";

export function ReceiptKeyDialog({
  source,
  flows,
  onClose,
  onCreated,
}: {
  source: string;
  flows: { value: string; label: string }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [scopes, setScopes] = useState(flows.map((f) => f.value));
  const [name, setName] = useState("Обмен 1С");
  const [days, setDays] = useState("365");
  const [secret, setSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const validDays =
    /^\d+$/.test(days) && Number(days) >= 1 && Number(days) <= 365;
  const issue = async () => {
    if (lock.current || !validDays || !name.trim() || !scopes.length) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await receiptIntegrationApi.createKey(source, {
        name: name.trim(),
        expiresIn: Number(days) * 86400,
        flows: Object.fromEntries(
          scopes.map((flow) => [flow, ["event:create"]]),
        ),
      });
      setSecret(result.key);
      onCreated();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <AdminModal
      title={secret ? "Ключ создан" : "Выпустить ключ"}
      isCloseDisabled={busy}
      onClose={onClose}
    >
      {secret ? (
        <div className="admin-form">
          <TextField
            label="API-ключ"
            value={secret}
            readOnly
            onChange={() => {}}
            autoComplete="off"
          />
          <Notice>
            Скопируйте ключ сейчас. После закрытия окна полный ключ больше не
            будет показан.
          </Notice>
          {error && <Notice tone="error">{error}</Notice>}
          <div className="admin-form-actions">
            <button
              type="button"
              className="admin-secondary-button"
              onClick={() => {
                void (
                  navigator.clipboard
                    ? navigator.clipboard.writeText(secret)
                    : Promise.reject(new Error("Clipboard unavailable"))
                )
                  .then(() => {
                    setCopied(true);
                    setError(null);
                  })
                  .catch(() =>
                    setError(
                      "Не удалось скопировать. Выделите и скопируйте ключ из поля.",
                    ),
                  );
              }}
            >
              {copied ? "Скопировано" : "Копировать"}
            </button>
            <button
              type="button"
              className="admin-primary-button"
              onClick={onClose}
            >
              Готово
            </button>
          </div>
        </div>
      ) : (
        <form
          className="admin-form"
          onSubmit={(e) => {
            e.preventDefault();
            void issue();
          }}
        >
          <TextField
            label="Название"
            required
            maxLength={100}
            value={name}
            onChange={setName}
            disabled={busy}
          />
          <SelectField
            label="Разрешённые обмены"
            multiple
            value={scopes}
            onChange={setScopes}
            options={flows}
            disabled={busy}
          />
          <TextField
            label="Срок действия, дней"
            type="number"
            min={1}
            max={365}
            step={1}
            value={days}
            onChange={setDays}
            disabled={busy}
            error={!validDays ? "Укажите от 1 до 365 дней." : undefined}
          />
          {error && <Notice tone="error">{error}</Notice>}
          <button
            type="submit"
            className="admin-primary-button"
            disabled={busy || !name.trim() || !validDays || !scopes.length}
          >
            {busy ? "Выпускаем…" : "Выпустить"}
          </button>
        </form>
      )}
    </AdminModal>
  );
}
