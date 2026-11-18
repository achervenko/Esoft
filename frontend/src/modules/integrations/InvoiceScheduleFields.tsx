import { AdminTextField as TextField } from "../../shared/ui/AdminFormControls";
import { Switch } from "../../shared/ui/Switch";
import { InvoiceScheduleStatus } from "./InvoiceScheduleStatus";
import type { useReceiptSourceForm } from "./useReceiptSourceForm";

export function InvoiceScheduleFields({
  statusCode,
  scheduleEnabled,
  setScheduleEnabled,
  scheduleInitial,
  setScheduleInitial,
  scheduleTimezone,
  setScheduleTimezone,
  scheduleInterval,
  setScheduleInterval,
  schedulePeriod,
  setSchedulePeriod,
  scheduleOverlap,
  setScheduleOverlap,
}: ReturnType<typeof useReceiptSourceForm>["schedule"]) {
  return (
    <>
      {statusCode && <InvoiceScheduleStatus code={statusCode} />}
      <label>
        Автоматический импорт накладных{" "}
        <Switch
          label="Автоматический импорт накладных"
          checked={scheduleEnabled}
          onChange={setScheduleEnabled}
        />
      </label>
      <TextField
        label="Начало первой синхронизации"
        placeholder="2026-11-18T08:00:00+03:00"
        value={scheduleInitial}
        onChange={setScheduleInitial}
        required={scheduleEnabled}
      />
      <TextField
        label="Часовой пояс 1С"
        value={scheduleTimezone}
        onChange={setScheduleTimezone}
        required
      />
      <TextField
        label="Интервал проверки, сек"
        type="number"
        min={1}
        value={scheduleInterval}
        onChange={setScheduleInterval}
        required
      />
      <TextField
        label="Размер периода, мин"
        type="number"
        min={1}
        value={schedulePeriod}
        onChange={setSchedulePeriod}
        required
      />
      <TextField
        label="Перекрытие, мин"
        type="number"
        min={0}
        value={scheduleOverlap}
        onChange={setScheduleOverlap}
        required
      />
    </>
  );
}
