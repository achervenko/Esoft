import { useReceiptPosition } from "./useReceiptPosition";
import { AdminModal } from "../../shared/ui/AdminModal";
import "../../shared/ui/PageActions.css";
import { useState } from "react";
import { receiptsApi } from "../../shared/api/warehouse-receipts-api";
import { hasPermission } from "../../shared/lib/permissions";
import {
  formatBusinessDateTime,
  formatCalendarDate,
} from "../../shared/lib/business-date";
import { LoadingIndicator } from "../../shared/ui/LoadingIndicator";
import { Notice } from "../../shared/ui/Notice";
import { ReceiptPlacementStepper } from "./ReceiptPlacementStepper";
import { useReceiptQuery } from "./useReceiptQuery";
import { ReceiptActionDialog, type ReceiptAction } from "./ReceiptActionDialog";
import { ReceiptReconcileDialog } from "./ReceiptReconcileDialog";

const conflicts: Record<string, string> = {
  SOURCE_CANCELLED_AFTER_PLACEMENT:
    "1С отменила документ после размещения товара.",
  SOURCE_LINES_CHANGED_AFTER_PLACEMENT: "1С изменила уже размещённые строки.",
  SOURCE_WAREHOUSE_CHANGED_AFTER_PLACEMENT:
    "1С изменила склад после размещения товара.",
  SOURCE_REPOSTED_AFTER_SETTLEMENT:
    "1С повторно провела приход после согласования отмены и корректировки остатков. Старые размещения не подтверждают новую приёмку. Приход остаётся отменённым; для новой поставки оформите отдельный приход.",
};
export function ReceiptDetails({
  id,
  actorId,
  permissions,
  onBack,
}: {
  id: string;
  actorId: string | null;
  permissions: readonly string[] | null;
  onBack: () => void;
}) {
  const query = useReceiptQuery((signal) => receiptsApi.get(id, signal), [id]);
  const [action, setAction] = useState<ReceiptAction | null>(null);
  const [reconcile, setReconcile] = useState<string | null>(null);
  const [position, setPosition] = useReceiptPosition(actorId, id);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const r = query.data;
  const canMap = hasPermission(permissions, "warehouse.receipts.map");
  const canManage = hasPermission(permissions, "warehouse.receipts.manage");
  const canResolve = hasPermission(permissions, "integrations.manage");
  const saved = () => {
    setAction(null);
    setReconcile(null);
    query.reload();
  };
  return (
    <>
      <div className="receipt-top-actions">
        <button
          className="page-back-button"
          type="button"
          disabled={placing}
          onClick={onBack}
        >
          ← Назад
        </button>
        <button
          className="admin-secondary-button"
          disabled={!r || placing}
          onClick={() => setActionsOpen(true)}
        >
          Действия
        </button>
      </div>
      <LoadingIndicator loading={query.loading && !r} />
      {query.error && (
        <Notice tone="error">
          {query.error} <button onClick={query.reload}>Повторить</button>
        </Notice>
      )}
      {r && (
        <>
          <header className="admin-page-header">
            <div>
              <h1>{r.documentNumber ?? `Приход №${r.id}`}</h1>
            </div>
          </header>
          {r.conflict && (
            <Notice tone="error">
              <strong>Требуется решение</strong>
              <p>{conflicts[r.conflict] ?? r.conflict}</p>
              <p>Размещение приостановлено. Физические остатки сохранены.</p>
              {canResolve && (
                <button
                  className="admin-secondary-button"
                  onClick={() => setAction({ kind: "resolve" })}
                >
                  Разобрать конфликт
                </button>
              )}
            </Notice>
          )}
          <ReceiptPlacementStepper
            onExit={onBack}
            receipt={r}
            actorId={actorId}
            permissions={permissions}
            position={position}
            onPositionChange={setPosition}
            saving={placing || query.loading || !!query.error}
            onSavingChange={setPlacing}
            onSaved={saved}
            onMap={(line) => setAction({ kind: "item", line })}
          />
          {actionsOpen && (
            <AdminModal title="Действия" onClose={() => setActionsOpen(false)}>
              <div className="admin-form receipt-actions-content">
                <details className="receipt-action-section">
                  <summary>Подробности прихода</summary>
                  <p>
                    Дата накладной:{" "}
                    {r.documentDate
                      ? formatCalendarDate(r.documentDate)
                      : "Без даты"}
                  </p>
                  <strong>
                    Склад: {r.warehouseNameSnapshot ?? "Не сопоставлен"}
                  </strong>
                  <small className="receipt-hint">
                    Получен: {formatBusinessDateTime(r.receivedAt)}
                  </small>

                  {!!r.settlementAdjustments?.length && (
                    <p>
                      Согласовано с 1С после корректировок:{" "}
                      {r.settlementAdjustments
                        .map((a) => `№${a.id}`)
                        .join(", ")}
                    </p>
                  )}
                  {r.comment && (
                    <section className="admin-card">
                      <h2>Комментарий</h2>
                      <p>{r.comment}</p>
                    </section>
                  )}
                  {r.source === "ONE_C" && (
                    <details className="admin-card">
                      <summary>Снимок документа и редакции</summary>
                      <h3>Применённый снимок</h3>
                      <pre className="receipt-source-document">
                        {JSON.stringify(r.sourceDocument, null, 2)}
                      </pre>
                      {r.pendingSourceDocument !== null && (
                        <>
                          <h3>
                            Предложенное изменение · редакция ESoft{" "}
                            {r.sourceVersion}
                          </h3>
                          <pre className="receipt-source-document">
                            {JSON.stringify(r.pendingSourceDocument, null, 2)}
                          </pre>
                        </>
                      )}
                    </details>
                  )}
                </details>
                {r.source === "ONE_C" &&
                  canMap &&
                  r.warehouseId &&
                  !r.conflict &&
                  r.status !== "CANCELLED" && (
                    <button
                      className="admin-secondary-button"
                      onClick={() => {
                        setActionsOpen(false);
                        setReconcile("");
                      }}
                    >
                      Связать с ручным приходом
                    </button>
                  )}
                <div className="receipt-actions">
                  {r.source === "MANUAL" &&
                    canManage &&
                    r.status === "RECEIVED" &&
                    r.lines.every((l) => l.placed === "0") && (
                      <button
                        className="admin-secondary-button"
                        onClick={() => {
                          setActionsOpen(false);
                          setAction({ kind: "cancel" });
                        }}
                      >
                        Отменить приход
                      </button>
                    )}
                </div>
              </div>
            </AdminModal>
          )}
          {action && (
            <ReceiptActionDialog
              actorId={actorId}
              receipt={r}
              action={action}
              canReconcileStock={hasPermission(
                permissions,
                "warehouse.adjustments.manage",
              )}
              onClose={() => setAction(null)}
              onSaved={saved}
            />
          )}
          {reconcile !== null && (
            <ReceiptReconcileDialog
              receipt={r}
              initialManualId={reconcile}
              onClose={() => setReconcile(null)}
              onSaved={saved}
            />
          )}
        </>
      )}
    </>
  );
}
