import { useEffect } from "react";
import { MapPin } from "lucide-react";
import type {
  Receipt,
  ReceiptLine,
} from "../../shared/api/warehouse-receipts-api";
import { hasPermission } from "../../shared/lib/permissions";
import { formatStockQuantity } from "../../shared/lib/warehouse-quantity";
import { Notice } from "../../shared/ui/Notice";
import { ReceiptPlaceForm } from "./ReceiptPlaceForm";
import { hasPendingReceiptSubmission } from "./useReceiptSubmission";
import { groupReceiptPlacements } from "./receipt-placement-locations";
import { quantityMilli } from "./receipt-utils";
import "./ReceiptPlacementStepper.css";

const unfinished = (line: ReceiptLine) =>
  line.sourceType === "GOODS" &&
  !line.reconciledToLineId &&
  (quantityMilli(line.remaining) ?? 0n) > 0n;

export function ReceiptPlacementStepper({
  receipt,
  actorId,
  permissions,
  position,
  onPositionChange,
  saving,
  onSavingChange,
  onSaved,
  onMap,
  onExit,
}: {
  receipt: Receipt;
  actorId: string | null;
  permissions: readonly string[] | null;
  position: string | null;
  onPositionChange: (id: string) => void;
  saving: boolean;
  onSavingChange: (value: boolean) => void;
  onSaved: () => void;
  onMap: (line: ReceiptLine) => void;
  onExit: () => void;
}) {
  const lines = receipt.lines;
  const needsAction = (entry: ReceiptLine) =>
    entry.sourceType !== "GOODS" ||
    unfinished(entry) ||
    hasPendingReceiptSubmission(actorId, `place:${receipt.id}:${entry.id}`);
  const first = lines.findIndex(needsAction);
  const selected = lines.findIndex((line) => line.id === position);
  const index = selected >= 0 ? selected : Math.max(first, 0);
  const line = lines[index];
  const remaining = lines.filter(needsAction);
  const unsupportedLines = lines.some((entry) => entry.sourceType !== "GOODS");
  const locations = line ? groupReceiptPlacements(line.placements) : [];
  const summary = (position === "summary" && remaining.length > 0) || !line;
  useEffect(() => {
    if (!summary && line && position !== line.id) onPositionChange(line.id);
  }, [summary, line, position, onPositionChange]);
  const canPlace = hasPermission(permissions, "warehouse.receipts.place");
  const canMap =
    hasPermission(permissions, "warehouse.receipts.map") &&
    hasPermission(permissions, "warehouse.catalog.links.manage");
  const pending =
    line &&
    hasPendingReceiptSubmission(actorId, `place:${receipt.id}:${line.id}`);
  const blocked =
    !!receipt.conflict ||
    !receipt.warehouseId ||
    receipt.status === "CANCELLED" ||
    !line?.itemId ||
    line.sourceType !== "GOODS" ||
    !!line.reconciledToLineId ||
    !unfinished(line);
  const choose = (id: string) => {
    if (saving) return;
    onPositionChange(id);
  };
  return (
    <section className="receipt-placement" aria-label="Пошаговое размещение">
      <nav className="receipt-placement-progress" aria-label="Позиции прихода">
        {lines.map((entry, i) => (
          <button
            key={entry.id}
            type="button"
            disabled={saving}
            aria-label={`Позиция ${i + 1}: ${entry.name}`}
            aria-current={
              !summary && entry.id === line?.id ? "step" : undefined
            }
            data-complete={!needsAction(entry)}
            onClick={() => choose(entry.id)}
          />
        ))}
      </nav>
      {summary ? (
        <section className="admin-card receipt-placement-card">
          <h2>
            {receipt.status === "CANCELLED"
              ? "Приход отменён"
              : unsupportedLines
                ? "Требуется внимание"
                : remaining.length
                  ? "Осталось разместить"
                  : "Размещение завершено"}
          </h2>
          {remaining.length ? (
            <>
              {unsupportedLines && (
                <Notice tone="error">
                  В документе есть позиции, которые нельзя разместить на склад.
                  Проверьте их тип в 1С. Приход остаётся незавершённым.
                </Notice>
              )}
              <div className="receipt-placement-list">
                {remaining.map((entry) => (
                  <button
                    key={entry.id}
                    className="admin-secondary-button"
                    title={entry.name}
                    onClick={() => choose(entry.id)}
                  >
                    {entry.name} ·{" "}
                    {entry.sourceType !== "GOODS"
                      ? `Тип «${entry.sourceType}» нельзя разместить`
                      : `${formatStockQuantity(entry.remaining)} ${entry.unit}${!entry.itemId ? " · Не сопоставлена" : ""}`}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p>Все доступные для размещения позиции обработаны.</p>
          )}
        </section>
      ) : (
        <>
          <div className="receipt-placement-position">
            <span>Позиция</span>
            <strong>
              {index + 1} / {lines.length}
            </strong>
          </div>
          <section className="admin-card receipt-placement-card">
            <small className="receipt-hint">
              Артикул: {line.article ?? "Не указан"}
            </small>
            <h2 title={line.name}>{line.name}</h2>
            {line.order && (
              <p>
                Заказ 1С: <strong>{line.order.number ?? "Без номера"}</strong>
                {line.order.name && ` · ${line.order.name}`}
              </p>
            )}
            <dl className="receipt-placement-totals">
              <div>
                <dt>Размещено</dt>
                <dd>
                  {formatStockQuantity(line.placed)} <small>{line.unit}</small>
                </dd>
              </div>
              <div>
                <dt>Осталось</dt>
                <dd>
                  {formatStockQuantity(line.remaining)}{" "}
                  <small>{line.unit}</small>
                </dd>
              </div>
            </dl>
            {!line.itemId && (
              <Notice>
                Номенклатура не сопоставлена.
                {canMap && receipt.source === "ONE_C" && (
                  <button
                    className="admin-secondary-button"
                    disabled={saving}
                    onClick={() => onMap(line)}
                  >
                    Сопоставить
                  </button>
                )}
              </Notice>
            )}
            {line.sourceType !== "GOODS" && (
              <Notice>Тип «{line.sourceType}» нельзя разместить.</Notice>
            )}
            {line.reconciledToLineId && (
              <Notice>
                Позиция связана с ручным приходом. Повторное размещение не
                требуется.
              </Notice>
            )}
            {locations.length > 0 && (
              <ul
                className="receipt-placement-locations"
                aria-label="Сохранённые размещения"
              >
                {locations.map((entry) => (
                  <li
                    key={entry.storageLocationId}
                    className="receipt-placement-location"
                  >
                    <div className="receipt-placement-location-heading">
                      <MapPin size={18} aria-hidden="true" />
                      <strong>{entry.location.name ?? "Место хранения"}</strong>
                    </div>
                    <div className="receipt-placement-location-result">
                      <strong>
                        {formatStockQuantity(entry.quantity)}{" "}
                        <small>{line.unit}</small>
                      </strong>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {canPlace && (!blocked || pending) ? (
              <ReceiptPlaceForm
                key={`${line.id}:${line.remaining}:${line.placed}`}
                inline
                canReadStock={hasPermission(
                  permissions,
                  "warehouse.stock.read",
                )}
                disabled={saving}
                actorId={actorId}
                receipt={receipt}
                line={line}
                onSavingChange={onSavingChange}
                onClose={() => {}}
                onSaved={() => {
                  onPositionChange(line.id);
                  onSaved();
                }}
              />
            ) : (
              canPlace &&
              unfinished(line) && (
                <button className="admin-primary-button" disabled>
                  Разместить
                </button>
              )
            )}
          </section>
        </>
      )}
      <footer className="receipt-placement-navigation">
        <button
          className="admin-secondary-button"
          disabled={saving || (!summary && index === 0)}
          onClick={() => {
            if (summary) onExit();
            else choose(lines[index - 1].id);
          }}
        >
          {summary ? "Выйти" : "Назад"}
        </button>
        {!summary && (
          <button
            className="admin-primary-button"
            disabled={saving}
            onClick={() => {
              if (
                summary ||
                (index + 1 === lines.length && !remaining.length)
              ) {
                onExit();
              } else {
                choose(
                  index + 1 < lines.length ? lines[index + 1].id : "summary",
                );
              }
            }}
          >
            {summary || (index + 1 === lines.length && !remaining.length)
              ? "Выйти"
              : index + 1 < lines.length
                ? "Далее"
                : "Итоги →"}
          </button>
        )}
      </footer>
    </section>
  );
}
