import { Badge } from "@chakra-ui/react";
import { useState } from "react";
import { useIncrementalList } from "../../shared/lib/useIncrementalList";
import { ListLoadMore } from "../../shared/ui/ListLoadMore";
import {
  receiptIntegrationApi,
  type IntegrationRun,
  type ReceiptSource,
} from "../../shared/api/receipt-integration-api";
import {
  formatBusinessDateTime,
  getBusinessTodayDateString,
} from "../../shared/lib/business-date";
import { AdminTextField } from "../../shared/ui/AdminFormControls";
import { DataTable } from "../../shared/ui/DataTable";
import { InfoTooltip } from "../../shared/ui/InfoTooltip";
import { Notice } from "../../shared/ui/Notice";
import { SelectField } from "../../shared/ui/SelectField";
import { invoiceSchedulePresentation } from "./invoice-schedule-presentation";

const flows = [
  { value: "warehouse.receipts", label: "Приходы склада" },
  { value: "orders.customers", label: "Заказы клиентов" },
];
const outcomes = [
  "SUCCESS",
  "FAILED",
  "PARTIAL_FAILURE",
  "BLOCKED",
  "RUNNING",
  "INTERRUPTED",
];
const outcomeLabel = (value: string) =>
  value === "SUCCESS" ? "Успешно" : invoiceSchedulePresentation(value).label;
const all = { value: "", label: "Все" };

export function IntegrationRunsSection({
  sources,
}: {
  sources: ReceiptSource[];
}) {
  const [today] = useState(getBusinessTodayDateString);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [source, setSource] = useState("");
  const [flow, setFlow] = useState("");
  const [outcome, setOutcome] = useState("");
  const [revision, setRevision] = useState(0);
  const valid = !!from && !!to && from <= to;
  const params = new URLSearchParams({ from, to });
  if (source) params.set("source", source);
  if (flow) params.set("flow", flow);
  if (outcome) params.set("outcome", outcome);
  const list = useIncrementalList<IntegrationRun>({
    queryKey: `${revision}:${params}`,
    enabled: valid,
    getKey: (row) => row.id,
    loadPage: (offset, signal) => {
      const query = new URLSearchParams(params.toString());
      query.set("page", String(offset / 25 + 1));
      return receiptIntegrationApi.runs(query, signal);
    },
  });
  const rows = list.data?.items ?? [];

  return (
    <section className="admin-card">
      <header>
        <h2>Последние обмены</h2>
        <button
          type="button"
          className="admin-secondary-button"
          onClick={() => setRevision((n) => n + 1)}
        >
          Обновить
        </button>
      </header>
      <div className="integration-run-filters">
        <AdminTextField
          label="Дата с"
          type="date"
          value={from}
          onChange={setFrom}
        />
        <AdminTextField
          label="Дата по"
          type="date"
          value={to}
          onChange={setTo}
        />
        <SelectField
          label="Источник"
          value={source}
          onChange={setSource}
          options={[
            all,
            ...sources.map(({ code, name }) => ({ value: code, label: name })),
          ]}
        />
        <SelectField
          label="Назначение"
          value={flow}
          onChange={setFlow}
          options={[all, ...flows]}
        />
        <SelectField
          label="Результат"
          value={outcome}
          onChange={setOutcome}
          options={[
            all,
            ...outcomes.map((value) => ({ value, label: outcomeLabel(value) })),
          ]}
        />
      </div>
      {!valid ? (
        <Notice>Укажите корректный период.</Notice>
      ) : list.loading && !list.data ? (
        <p role="status">Загрузка…</p>
      ) : list.error && !list.data ? (
        <Notice tone="error">
          {list.error}
          <button
            type="button"
            className="admin-secondary-button"
            onClick={list.retry}
          >
            Повторить загрузку
          </button>
        </Notice>
      ) : rows.length === 0 ? (
        <p>За выбранный период обменов не было.</p>
      ) : (
        <DataTable
          rows={rows}
          windowed
          getRowKey={(row) => row.id}
          defaultSort={{ key: "startedAt", direction: "desc" }}
          serverSorted
          columns={[
            {
              key: "startedAt",
              label: "Время запуска",
              isSortable: false,
              render: (row) => formatBusinessDateTime(row.startedAt),
            },
            {
              key: "source",
              label: "Источник",
              isSortable: false,
              render: (row) => row.sourceName,
            },
            {
              key: "flow",
              label: "Назначение",
              isSortable: false,
              render: (row) =>
                flows.find(({ value }) => value === row.flowCode)?.label ??
                row.flowCode,
            },
            {
              key: "outcome",
              label: "Результат",
              isSortable: false,
              render: (row) => (
                <Badge
                  className="info-tooltip-tone-inherit"
                  colorPalette={invoiceSchedulePresentation(row.outcome).color}
                >
                  {outcomeLabel(row.outcome)}
                  {row.errorCode && (
                    <InfoTooltip
                      label="Подробности ошибки"
                      reasons={[`Код: ${row.errorCode}`]}
                    />
                  )}
                </Badge>
              ),
            },
            {
              key: "received",
              label: "Получено",
              isSortable: false,
              render: (row) => row.received,
            },
          ]}
        />
      )}
      <ListLoadMore list={list} showCount={false} />
    </section>
  );
}
