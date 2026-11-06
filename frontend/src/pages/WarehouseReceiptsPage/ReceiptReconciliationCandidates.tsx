import {
  receiptsApi,
  type Receipt,
} from "../../shared/api/warehouse-receipts-api";
import { formatCalendarDate } from "../../shared/lib/business-date";
import { Notice } from "../../shared/ui/Notice";
import { LoadingIndicator } from "../../shared/ui/LoadingIndicator";
import { useReceiptQuery } from "./useReceiptQuery";
import { setHashRoute } from "../../lib/hash-router";

export function ReceiptReconciliationCandidates({
  receipt,
  onSelect,
}: {
  receipt: Receipt;
  onSelect: (id: string) => void;
}) {
  const query = useReceiptQuery(
    (signal) => receiptsApi.reconciliationCandidates(receipt.id, signal),
    [receipt],
  );
  return (
    <>
      <LoadingIndicator loading={query.loading} />
      {query.error && (
        <Notice tone="error">
          Не удалось проверить ручные приходы. Перед размещением проверьте, не
          был ли товар принят вручную.{" "}
          <button
            type="button"
            className="admin-secondary-button"
            onClick={query.reload}
          >
            Повторить проверку
          </button>
        </Notice>
      )}
      {!!query.data?.items.length && (
        <Notice>
          <strong>Возможно, этот товар уже принят вручную</strong>
          <p>
            Проверьте документы перед размещением: связь засчитает уже принятый
            товар без повторного увеличения остатков.
          </p>
          {query.data.items.map((candidate) => (
            <div key={candidate.id} className="admin-card">
              <strong>
                {candidate.documentNumber ?? `Приход №${candidate.id}`}
              </strong>
              {candidate.documentDate && (
                <small>{formatCalendarDate(candidate.documentDate)}</small>
              )}
              <p>
                {[
                  candidate.sameNumber && "Совпадает номер накладной",
                  candidate.sameItems
                    ? "Совпадает набор товаров"
                    : `Совпадает ${candidate.matchedItems} из ${candidate.manualItems} позиций`,
                  candidate.sameQuantities
                    ? "Совпадают количества"
                    : candidate.sameItems && "Количества различаются",
                  candidate.dateDistance === 0 && "Совпадает дата накладной",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {candidate.status === "PLACING" && (
                <p>
                  Ручной приход размещён частично. Сначала завершите его
                  размещение, затем свяжите документы.
                </p>
              )}
              <button
                type="button"
                className="admin-secondary-button"
                onClick={() =>
                  candidate.status === "PLACED"
                    ? onSelect(candidate.id)
                    : setHashRoute(`#/warehouse/receipts/${candidate.id}`)
                }
              >
                {candidate.status === "PLACED"
                  ? "Проверить и связать"
                  : "Открыть ручной приход"}
              </button>
            </div>
          ))}
          <small>
            Это возможные совпадения. Связь появится только после вашего
            подтверждения.
          </small>
        </Notice>
      )}
    </>
  );
}
