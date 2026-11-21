import { useEffect, useState } from "react";
import {
  receiptIntegrationApi,
  type InvoiceScheduleStatus as Status,
} from "../../shared/api/receipt-integration-api";
import { Notice } from "../../shared/ui/Notice";
import { formatBusinessDateTime } from "../../shared/lib/business-date";

import { invoiceSchedulePresentation } from "./invoice-schedule-presentation";

export function InvoiceScheduleStatus({ code }: { code: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void receiptIntegrationApi.invoiceSchedule(code, controller.signal).then(
      (result) => {
        if (!controller.signal.aborted) setStatus(result);
      },
      () => {
        if (!controller.signal.aborted) setFailed(true);
      },
    );
    return () => controller.abort();
  }, [code]);
  if (failed)
    return (
      <Notice tone="error">Не удалось загрузить состояние импорта.</Notice>
    );
  if (!status) return null;
  const { latest, lastSuccessAt } = status;
  return (
    <div>
      <div>
        {status.enabled ? "Расписание включено" : "Расписание выключено"}
      </div>
      <div>
        {lastSuccessAt
          ? `Последний успешный импорт — ${formatBusinessDateTime(lastSuccessAt)}`
          : "Успешных импортов пока нет"}
      </div>
      {latest && (
        <>
          <div>
            {invoiceSchedulePresentation(latest.outcome).label} ·{" "}
            {formatBusinessDateTime(latest.periodFrom)} —{" "}
            {formatBusinessDateTime(latest.periodTo)}
          </div>
          {latest.syncedThrough && (
            <div>
              Загружено по {formatBusinessDateTime(latest.syncedThrough)}
            </div>
          )}
          {latest.nextAttemptAt && (
            <div>
              Повтор после {formatBusinessDateTime(latest.nextAttemptAt)}
            </div>
          )}
          {latest.errorCode && <div>Код ошибки {latest.errorCode}</div>}
        </>
      )}
    </div>
  );
}
