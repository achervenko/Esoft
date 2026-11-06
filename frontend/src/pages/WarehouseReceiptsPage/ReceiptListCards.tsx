import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import type { ReceiptSummary } from "../../shared/api/warehouse-receipts-api";
import { useWindowedGrid } from "../../shared/lib/useWindowedGrid";

type Props = {
  items: ReceiptSummary[];
  onOpen: (id: string) => void;
  getClassName: (row: ReceiptSummary) => string | undefined;
  document: (row: ReceiptSummary) => ReactNode;
  progress: (row: ReceiptSummary) => ReactNode;
  received: (row: ReceiptSummary) => ReactNode;
};
export function ReceiptListCards({
  items,
  onOpen,
  getClassName,
  document,
  progress,
  received,
}: Props) {
  const window = useWindowedGrid(items.length);
  return (
    <div
      className="receipt-cards"
      ref={window.gridRef}
      role="list"
      aria-label="Приходы"
    >
      {window.before > 0 && (
        <div aria-hidden="true" style={{ height: window.before }} />
      )}
      {items.slice(window.start, window.end).map((row, index) => (
        <article
          key={row.id}
          role="listitem"
          data-grid-index={window.start + index}
          className={`receipt-card ${getClassName(row) ?? ""}`}
        >
          <button
            type="button"
            className="receipt-card-open"
            onClick={() => onOpen(row.id)}
          >
            {document(row)}
            <ChevronRight size={20} aria-hidden="true" />
            <span className="receipt-card-warehouse">
              {row.warehouseNameSnapshot ?? "Склад не сопоставлен"}
            </span>
            <span className="receipt-card-metric">
              <span className="receipt-card-caption">Размещено</span>
              {progress(row)}
            </span>
            <span className="receipt-card-received">
              <span>Получен</span>
              {received(row)}
            </span>
          </button>
        </article>
      ))}
      {window.after > 0 && (
        <div aria-hidden="true" style={{ height: window.after }} />
      )}
    </div>
  );
}
