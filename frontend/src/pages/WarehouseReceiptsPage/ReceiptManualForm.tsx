import { ReceiptDraftItemDialog } from "./ReceiptDraftItemDialog";
import { useEffect, useRef, useState } from "react";
import { receiptsApi } from "../../shared/api/warehouse-receipts-api";
import type { WarehouseItem } from "../../shared/api/warehouse-catalog-api";
import { TextField, TextareaField } from "../../shared/ui/TextField";
import { SelectField } from "../../shared/ui/SelectField";
import { Notice } from "../../shared/ui/Notice";
import { getApiErrorMessage } from "../../shared/api/api-error";
import { getBusinessTodayDateString } from "../../shared/lib/business-date";
import { ReceiptItemPicker } from "../../shared/warehouse/ReceiptItemPicker";
import { useReceiptStorage } from "./useReceiptStorage";
import { quantityError } from "./receipt-utils";
import { useReceiptSubmission } from "./useReceiptSubmission";
import { AdminModal } from "../../shared/ui/AdminModal";
import { Plus, Trash2 } from "lucide-react";
import { createRequestKey } from "../../shared/lib/request-key";

export function ReceiptManualForm({
  actorId,
  canCreateItems = false,
  onCreated,
  onCancel,
}: {
  actorId: string | null;
  canCreateItems?: boolean;
  onCreated: (id: string) => void;
  onCancel: () => void;
}) {
  const [drafts, setDrafts] = useState<WarehouseItem[]>([]);
  const [editingDraft, setEditingDraft] = useState<{
    lineKey: string;
    search: string;
    item?: WarehouseItem;
  } | null>(null);
  const [warehouseId, setWarehouse] = useState("");
  const [number, setNumber] = useState("");
  const [date, setDate] = useState(getBusinessTodayDateString);
  const [comment, setComment] = useState("");
  const [lines, setLines] = useState<
    { item: WarehouseItem | null; quantity: string; key: string }[]
  >(() => [{ item: null, quantity: "1", key: createRequestKey() }]);
  const [validatedQuantities, setValidatedQuantities] = useState<Set<string>>(
    () => new Set(),
  );
  const [lineNotice, setLineNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const submission = useReceiptSubmission<
    Omit<Parameters<typeof receiptsApi.create>[0], "requestKey">
  >(actorId, "manual");
  const savingRef = useRef(false);
  const choices = useReceiptStorage();
  useEffect(() => {
    if (!warehouseId && choices.warehouses.length === 1)
      setWarehouse(choices.warehouses[0].id);
  }, [choices.warehouses, warehouseId]);
  return (
    <AdminModal
      className="receipt-manual-modal"
      title="Ручной приход"
      onClose={onCancel}
      isCloseDisabled={saving}
    >
      {editingDraft && (
        <ReceiptDraftItemDialog
          initial={editingDraft.item}
          search={editingDraft.search}
          drafts={drafts}
          onClose={() => setEditingDraft(null)}
          onSelect={(item) => {
            if (item.id.startsWith("draft:"))
              setDrafts((current) => [
                ...current.filter((d) => d.id !== item.id),
                item,
              ]);
            setLines((current) =>
              current.map((l) =>
                l.key === editingDraft.lineKey ||
                (editingDraft.item && l.item?.id === editingDraft.item.id)
                  ? { ...l, item }
                  : l,
              ),
            );
            setEditingDraft(null);
          }}
        />
      )}
      <form
        className="admin-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (savingRef.current) return;
          if (
            !submission.pending &&
            (!lines.length ||
              lines.some((l) => !l.item || quantityError(l.quantity)))
          ) {
            setError("Добавьте товары и проверьте количество каждой строки.");
            return;
          }
          const body = submission.pending?.body ?? {
            warehouseId,
            ...(number.trim() ? { documentNumber: number.trim() } : {}),
            ...(date ? { documentDate: date } : {}),
            ...(comment.trim() ? { comment: comment.trim() } : {}),
            newItems: drafts
              .filter((d) => lines.some((l) => l.item?.id === d.id))
              .map((d) => ({
                draftId: d.id.slice(6),
                item: { article: d.article, name: d.name, unit: d.unit },
              })),
            lines: lines.map((l) => ({
              ...(l.item!.id.startsWith("draft:")
                ? { draftId: l.item!.id.slice(6) }
                : { itemId: l.item!.id }),
              quantity: l.quantity.replace(",", "."),
            })),
          };
          savingRef.current = true;
          setSaving(true);
          setError(null);
          try {
            const result = await submission.submit(body, receiptsApi.create);
            onCreated(result.id);
          } catch (err) {
            setError(getApiErrorMessage(err));
          } finally {
            savingRef.current = false;
            setSaving(false);
          }
        }}
      >
        <fieldset
          disabled={saving || !!submission.pending}
          className="receipt-fields"
        >
          <SelectField
            label="Склад"
            required
            value={warehouseId}
            onChange={setWarehouse}
            searchable
            options={choices.warehouses.map((w) => ({
              value: w.id,
              label: w.name,
            }))}
            placeholder=""
          />
          <div className="receipt-grid">
            <TextField
              label="Номер накладной"
              value={number}
              onChange={setNumber}
              maxLength={100}
            />
            <TextField
              label="Дата накладной"
              type="date"
              value={date}
              onChange={setDate}
            />
          </div>
          {lines.map((line, index) => (
            <div className="receipt-line-editor" key={line.key}>
              <div>
                <ReceiptItemPicker
                  drafts={drafts}
                  onCreate={
                    canCreateItems
                      ? (search) =>
                          setEditingDraft({ lineKey: line.key, search })
                      : undefined
                  }
                  value={line.item}
                  focusOnMount={index > 0}
                  onChange={(item) =>
                    setLines((current) =>
                      current.map((row) =>
                        row.key === line.key ? { ...row, item } : row,
                      ),
                    )
                  }
                />
                {line.item?.id.startsWith("draft:") && (
                  <button
                    type="button"
                    className="admin-secondary-button"
                    onClick={() =>
                      setEditingDraft({
                        lineKey: line.key,
                        search: "",
                        item: line.item!,
                      })
                    }
                  >
                    Новая · Изменить
                  </button>
                )}
              </div>
              <TextField
                label={
                  line.item ? `Количество, ${line.item.unit}` : "Количество"
                }
                value={line.quantity}
                inputMode="decimal"
                onChange={(quantity) =>
                  setLines(
                    lines.map((l, i) => (i === index ? { ...l, quantity } : l)),
                  )
                }
                onBlur={() =>
                  setValidatedQuantities((current) =>
                    new Set(current).add(line.key),
                  )
                }
                error={
                  validatedQuantities.has(line.key)
                    ? (quantityError(line.quantity) ?? undefined)
                    : undefined
                }
              />
              <button
                type="button"
                className="admin-secondary-button"
                aria-label={`Удалить строку ${index + 1}`}
                onClick={() => {
                  if (lines.length === 1) {
                    setLineNotice(
                      "В приходе должна остаться хотя бы одна строка.",
                    );
                    return;
                  }
                  setLineNotice(null);
                  setLines(lines.filter((_, i) => i !== index));
                }}
              >
                <Trash2 size={18} aria-hidden="true" />
              </button>
            </div>
          ))}
          <button
            className="admin-secondary-button"
            type="button"
            onClick={() => {
              if (lines.length >= 100) {
                setLineNotice(
                  "В одном приходе можно добавить не больше 100 строк.",
                );
                return;
              }
              setLineNotice(null);
              setLines((current) => [
                ...current,
                { item: null, quantity: "1", key: createRequestKey() },
              ]);
            }}
          >
            <Plus size={18} aria-hidden="true" /> Добавить строку
          </button>
          {lineNotice && <Notice>{lineNotice}</Notice>}
          <TextareaField
            label="Комментарий"
            value={comment}
            onChange={setComment}
            maxLength={4000}
          />
        </fieldset>
        {(error || choices.error) && (
          <Notice tone="error">{error ?? choices.error}</Notice>
        )}
        {submission.pending && !saving && (
          <Notice>
            Предыдущая отправка ещё не подтверждена. Проверьте её повторным
            запросом: данные и ключ останутся прежними.
          </Notice>
        )}
        <div className="admin-form-actions">
          <button
            type="button"
            className="admin-secondary-button"
            disabled={saving}
            onClick={onCancel}
          >
            Отмена
          </button>
          <button
            className="admin-primary-button"
            disabled={
              saving ||
              (!submission.pending &&
                (!warehouseId ||
                  !lines.length ||
                  lines.some(
                    (line) => !line.item || quantityError(line.quantity),
                  )))
            }
          >
            {saving
              ? "Сохранение…"
              : submission.pending
                ? "Проверить предыдущую отправку"
                : "Создать приход"}
          </button>
        </div>
      </form>
    </AdminModal>
  );
}
