import { useEffect, useRef, useState } from "react";
import {
  receiptsApi,
  type Receipt,
} from "../../shared/api/warehouse-receipts-api";
import { AdminModal } from "../../shared/ui/AdminModal";
import { AdminFormActions } from "../../shared/ui/AdminFormControls";
import { SelectField } from "../../shared/ui/SelectField";
import { SearchToolbar } from "../../shared/ui/SearchToolbar";
import { Notice } from "../../shared/ui/Notice";
import { getApiErrorMessage } from "../../shared/api/api-error";
import { useReceiptQuery } from "./useReceiptQuery";
import { quantityMilli } from "./receipt-utils";

export function ReceiptReconcileDialog({
  receipt,
  initialManualId = "",
  onClose,
  onSaved,
}: {
  receipt: Receipt;
  initialManualId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [manual, setManual] = useState<Receipt | null>(null);
  const [manualId, setManualId] = useState(initialManualId);
  const [pairs, setPairs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const [manualLoading, setManualLoading] = useState(false);
  const list = useReceiptQuery(
    (signal) =>
      receiptsApi.list(
        new URLSearchParams({
          source: "MANUAL",
          status: "PLACED",
          warehouseId: receipt.warehouseId!,
          search,
          page: String(page),
          limit: "25",
        }),
        signal,
      ),
    [receipt.warehouseId, search, page],
  );
  useEffect(() => {
    const controller = new AbortController();
    setManual(null);
    setPairs({});
    setManualLoading(!!manualId);
    if (!manualId) return;
    setError(null);
    void receiptsApi
      .get(manualId, controller.signal)
      .then((manual) => {
        if (controller.signal.aborted) return;
        setManual(manual);
        const pairs: Record<string, string> = {};
        for (const line of manual.lines) {
          const matches = receipt.lines.filter(
            (target) =>
              !!line.itemId &&
              target.itemId === line.itemId &&
              target.unit === line.unit &&
              target.sourceType === "GOODS",
          );
          if (matches.length === 1) pairs[line.id] = matches[0].id;
        }
        setPairs(pairs);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(getApiErrorMessage(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setManualLoading(false);
      });
    return () => controller.abort();
  }, [manualId, receipt.lines]);
  const selectedIds = manual?.lines.map((l) => pairs[l.id]) ?? [];
  const valid =
    !manualLoading &&
    !!manual &&
    manual.lines.every((l) => !!pairs[l.id] && !l.reconciledToLineId) &&
    receipt.lines.every((target) => {
      const incoming = manual.lines
        .filter((l) => pairs[l.id] === target.id)
        .reduce((sum, l) => sum + (quantityMilli(l.placed) ?? 0n), 0n);
      return incoming <= (quantityMilli(target.remaining) ?? 0n);
    });
  return (
    <AdminModal
      title="Связать с ручным приходом"
      onClose={onClose}
      isCloseDisabled={saving}
    >
      <form
        className="admin-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy.current || !valid || !manual) return;
          busy.current = true;
          setSaving(true);
          setError(null);
          try {
            await receiptsApi.reconcile(receipt.id, {
              manualReceiptId: manual.id,
              lines: manual.lines.map((l) => ({
                manualLineId: l.id,
                receiptLineId: pairs[l.id],
              })),
            });
            onSaved();
          } catch (err) {
            setError(getApiErrorMessage(err));
          } finally {
            busy.current = false;
            setSaving(false);
          }
        }}
      >
        <Notice>
          Связываются все строки полностью размещённого ручного прихода на этом
          складе. Остатки повторно не увеличиваются.
        </Notice>
        <fieldset disabled={saving} className="receipt-fields">
          <SearchToolbar
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            label="Поиск ручного прихода по номеру"
          />
          <SelectField
            label="Ручной приход"
            value={manualId}
            placeholder=""
            options={[
              ...(manualId && !list.data?.items.some((r) => r.id === manualId)
                ? [
                    {
                      id: manualId,
                      documentNumber:
                        manual?.documentNumber ?? `Приход №${manualId}`,
                    },
                  ]
                : []),
              ...(list.data?.items ?? []),
            ].map((r) => ({
              value: r.id,
              label: r.documentNumber ?? `Приход №${r.id}`,
            }))}
            onChange={setManualId}
          />
          <div className="admin-form-actions">
            <button
              type="button"
              className="admin-secondary-button"
              disabled={page === 1 || list.loading}
              onClick={() => setPage((p) => p - 1)}
            >
              Назад
            </button>
            <button
              type="button"
              className="admin-secondary-button"
              disabled={list.loading || page * 25 >= (list.data?.total ?? 0)}
              onClick={() => setPage((p) => p + 1)}
            >
              Далее
            </button>
          </div>
          {manual?.lines.map((l) => (
            <div key={l.id}>
              <strong>
                {l.name} · {l.placed} {l.unit}
              </strong>
              {l.reconciledToLineId ? (
                <Notice tone="error">Строка уже связана с приходом.</Notice>
              ) : (
                <SelectField
                  label="Строка документа 1С"
                  placeholder=""
                  value={pairs[l.id] ?? ""}
                  onChange={(id) => setPairs((p) => ({ ...p, [l.id]: id }))}
                  options={receipt.lines
                    .filter(
                      (target) =>
                        !!l.itemId &&
                        target.itemId === l.itemId &&
                        target.unit === l.unit &&
                        target.sourceType === "GOODS",
                    )
                    .map((target) => ({
                      value: target.id,
                      label: `${target.name} — осталось ${target.remaining} ${target.unit}`,
                    }))}
                />
              )}
            </div>
          ))}
          {manual && selectedIds.every(Boolean) && !valid && (
            <Notice tone="error">
              Проверьте связи: количество не должно превышать оставшееся в
              документе 1С.
            </Notice>
          )}
        </fieldset>
        {(error || list.error) && (
          <Notice tone="error">{error ?? list.error}</Notice>
        )}
        <AdminFormActions
          isSaving={saving}
          onClose={onClose}
          submitDisabled={!valid}
        />
      </form>
    </AdminModal>
  );
}
