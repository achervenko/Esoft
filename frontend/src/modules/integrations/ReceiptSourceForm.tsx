import type {
  ReceiptSource,
  IntegrationFlowRegistration,
} from "../../shared/api/receipt-integration-api";
import { AdminModal } from "../../shared/ui/AdminModal";
import {
  AdminFormActions,
  AdminTextField as TextField,
} from "../../shared/ui/AdminFormControls";
import { SelectField } from "../../shared/ui/SelectField";
import { Switch } from "../../shared/ui/Switch";
import { Notice } from "../../shared/ui/Notice";
import { InvoiceScheduleFields } from "./InvoiceScheduleFields";
import { ReceiptSourceCredentials } from "./ReceiptSourceCredentials";
import { useReceiptSourceForm } from "./useReceiptSourceForm";

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
  const {
    name,
    setName,
    baseUrl,
    setUrl,
    selectedFlows,
    setSelectedFlows,
    active,
    setActive,
    saving,
    error,
    submitDisabled,
    submit,
    showSchedule,
    credentials,
    schedule,
  } = useReceiptSourceForm(source, availableFlows, onSaved);
  return (
    <AdminModal
      title={source ? "Настройки источника" : "Новый источник 1С"}
      onClose={onClose}
      isCloseDisabled={saving}
    >
      <form className="admin-form" onSubmit={submit}>
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
          <ReceiptSourceCredentials {...credentials} editing={!!source} />
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
          {showSchedule && <InvoiceScheduleFields {...schedule} />}
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
