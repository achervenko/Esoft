import { ChevronRight, TriangleAlert } from "lucide-react";
import { useMediaQuery } from "../../shared/lib/useMediaQuery";
import { memo, useLayoutEffect, useRef, useState } from "react";
import type { ReceiptSummary } from "../../shared/api/warehouse-receipts-api";
import { ReceiptListCards } from "./ReceiptListCards";
import { DataTable, type DataTableColumn } from "../../shared/ui/DataTable";
import {
  formatBusinessDateTime,
  getBusinessDateString,
  getBusinessTodayDateString,
} from "../../shared/lib/business-date";
import { formatStockQuantity } from "../../shared/lib/warehouse-quantity";
import { receiptQuantityPercent } from "./receipt-utils";

export type ReceiptListSort = {
  key:
    | "createdAt"
    | "receivedAt"
    | "documentNumber"
    | "warehouseNameSnapshot"
    | "status";
  direction: "asc" | "desc";
};

export function ReceiptListTable({
  items,
  onOpen,
  sort = { key: "receivedAt", direction: "desc" },
  onSortChange,
}: {
  items: ReceiptSummary[];
  sort?: ReceiptListSort;
  onSortChange?: (sort: ReceiptListSort) => void;
  onOpen: (id: string) => void;
}) {
  const today = getBusinessTodayDateString();
  const container = useRef<HTMLDivElement>(null);
  const [narrowContainer, setMobile] = useState(false);
  const mobileViewport = useMediaQuery("(max-width: 760px)");
  const mobile = mobileViewport || narrowContainer;
  useLayoutEffect(() => {
    const element = container.current;
    if (!element) return;
    const measure = () => {
      const width = element.getBoundingClientRect().width;
      const minimum =
        Number.parseFloat(
          getComputedStyle(element).getPropertyValue(
            "--receipt-table-min-width",
          ),
        ) || 650;
      if (width > 0) setMobile(width < minimum);
    };
    measure();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    observer?.observe(element);
    return () => observer?.disconnect();
  }, []);
  const rowClassName = (row: ReceiptSummary) =>
    row.conflict
      ? "receipt-conflict-row"
      : row.warehouseId === null || row.unmappedLineCount
        ? "receipt-warning-row"
        : row.hasReconciliationCandidates
          ? "receipt-info-row"
          : undefined;
  const columns: DataTableColumn<ReceiptSummary, string>[] = [
    {
      key: "documentNumber",
      label: "Документ",
      className: "receipt-document-cell",
      sortValue: (row) => row.documentNumber ?? "",
      render: (row) => (
        <div
          className={`receipt-document-label${row.conflict || row.warehouseId === null || row.unmappedLineCount || row.hasReconciliationCandidates ? " receipt-document-conflict" : ""}`}
          title={row.documentNumber ?? `Приход №${row.id}`}
        >
          {(row.conflict ||
            row.warehouseId === null ||
            !!row.unmappedLineCount ||
            row.hasReconciliationCandidates) && (
            <TriangleAlert
              className="receipt-conflict-icon"
              size={18}
              aria-hidden="true"
            />
          )}
          <span className="receipt-document-number">
            {row.documentNumber ?? `Приход №${row.id}`}
          </span>
          <div className="receipt-document-meta">
            <small className="receipt-hint">
              {row.source === "ONE_C" ? "1С" : "Ручной"}
            </small>
            {row.conflict && (
              <span className="receipt-conflict-badge">Конфликт 1С</span>
            )}
            {row.warehouseId === null && (
              <span className="receipt-warning-badge">
                Склад не сопоставлен
              </span>
            )}
            {!!row.unmappedLineCount && (
              <span className="receipt-warning-badge">
                Сопоставьте товары: {row.unmappedLineCount}
              </span>
            )}
            {row.hasReconciliationCandidates && (
              <span className="receipt-info-badge">
                Возможно, уже принято вручную
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "warehouseNameSnapshot",
      label: "Склад",
      className: "receipt-warehouse-cell",
      sortValue: (row) => row.warehouseNameSnapshot ?? "",
      render: (row) => row.warehouseNameSnapshot ?? "Не сопоставлен",
    },
    {
      key: "progress",
      label: "Размещено",
      className: "receipt-progress-cell",
      isSortable: false,
      render: (row) => {
        const percent = receiptQuantityPercent(
          row.placedQuantity,
          row.totalQuantity,
        );
        return (
          <div
            className={`receipt-progress receipt-progress-${row.status.toLowerCase()}`}
          >
            <div className="receipt-progress-caption">
              <span>
                {formatStockQuantity(row.placedQuantity)} из{" "}
                {formatStockQuantity(row.totalQuantity)}
              </span>
              <small className="receipt-hint">
                {String(percent).replace(".", ",")}%
              </small>
            </div>
            <div
              className="receipt-progress-track"
              role="progressbar"
              aria-label="Прогресс размещения по количеству"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
            >
              <span style={{ width: `${percent}%` }} />
            </div>
          </div>
        );
      },
    },
    {
      key: "receivedAt",
      label: "Получен",
      className: "receipt-created-cell",
      sortValue: (row) => row.receivedAt,
      render: (row) => (
        <ReceiptReceivedTime value={row.receivedAt} today={today} />
      ),
    },
    {
      key: "open",
      label: "",
      className: "receipt-open-cell",
      isSortable: false,
      render: () => (
        <ChevronRight size={20} strokeWidth={1.5} aria-hidden="true" />
      ),
    },
  ];
  return (
    <div className="receipt-list-layout" ref={container}>
      {mobile ? (
        <ReceiptListCards
          items={items}
          onOpen={onOpen}
          getClassName={rowClassName}
          document={columns[0].render}
          progress={columns[2].render}
          received={columns[3].render}
        />
      ) : (
        <DataTable
          rows={items}
          getRowKey={(row) => row.id}
          getRowClassName={rowClassName}
          defaultSort={{ key: "receivedAt", direction: "desc" }}
          sort={sort}
          onSortChange={(next) => {
            if (
              [
                "createdAt",
                "receivedAt",
                "documentNumber",
                "warehouseNameSnapshot",
                "status",
              ].includes(next.key)
            )
              onSortChange?.(next as ReceiptListSort);
          }}
          serverSorted
          windowed
          onRowClick={(row) => onOpen(row.id)}
          columns={columns}
        />
      )}
    </div>
  );
}

const ReceiptReceivedTime = memo(function ReceiptReceivedTime({
  value,
  today,
}: {
  value: string;
  today: string;
}) {
  const previousDay = new Date(`${today}T00:00:00Z`);
  previousDay.setUTCDate(previousDay.getUTCDate() - 1);
  const yesterday = previousDay.toISOString().slice(0, 10);
  const day = getBusinessDateString(new Date(value));
  const relativeDay =
    day === today ? "Сегодня" : day === yesterday ? "Вчера" : null;
  const time = formatBusinessDateTime(value, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const date = formatBusinessDateTime(value, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return (
    <time dateTime={value} title={formatBusinessDateTime(value)}>
      <span>{relativeDay ? time : date}</span>
      <small className="receipt-hint">{relativeDay ?? time}</small>
    </time>
  );
});
