import { useEffect, useState } from "react";
import {
  warehouseCatalogApi,
  type WarehouseItem,
} from "../../shared/api/warehouse-catalog-api";
import { AdminModal } from "../../shared/ui/AdminModal";
import { TextField } from "../../shared/ui/TextField";
import { Notice } from "../../shared/ui/Notice";
import { getApiErrorMessage } from "../../shared/api/api-error";
import { createRequestKey } from "../../shared/lib/request-key";

export function ReceiptDraftItemDialog({
  initial,
  search,
  drafts,
  onClose,
  onSelect,
}: {
  initial?: WarehouseItem;
  search: string;
  drafts: WarehouseItem[];
  onClose: () => void;
  onSelect: (item: WarehouseItem) => void;
}) {
  const [article, setArticle] = useState(initial?.article ?? search);
  const [name, setName] = useState(initial?.name ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? "");
  const [check, setCheck] = useState<{
    article: string;
    duplicate?: WarehouseItem;
    error?: string;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setCheck(null);
    if (!article.trim()) return;
    const timer = setTimeout(() => {
      void (async () => {
        const local = drafts.find(
          (d) => d.id !== initial?.id && d.article === article.trim(),
        );
        if (local) return { article, duplicate: local };
        for (let offset = 0; ; offset += 100) {
          const page = await warehouseCatalogApi.list(
            new URLSearchParams({
              q: article.trim(),
              limit: "100",
              offset: String(offset),
            }),
            controller.signal,
          );
          const duplicate = page.items.find(
            (item) => item.article === article.trim(),
          );
          if (duplicate) return { article, duplicate };
          if (!page.items.length || offset + page.items.length >= page.total)
            return { article };
        }
      })()
        .then((result) => {
          if (!controller.signal.aborted) setCheck(result);
        })
        .catch((error) => {
          if (!controller.signal.aborted)
            setCheck({ article, error: getApiErrorMessage(error) });
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [article, drafts, initial?.id]);
  const checked = check?.article === article;
  const duplicate = checked ? check.duplicate : undefined;
  return (
    <AdminModal title="Новая номенклатура" onClose={onClose}>
      <form
        className="admin-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (
            !checked ||
            check.error ||
            duplicate ||
            !article.trim() ||
            !name.trim() ||
            !unit.trim()
          )
            return;
          onSelect({
            id: initial?.id ?? `draft:${createRequestKey()}`,
            article: article.trim(),
            name: name.trim(),
            unit: unit.trim(),
            comment: null,
            isActive: true,
          });
        }}
      >
        <TextField
          label="Артикул"
          value={article}
          onChange={setArticle}
          required
          maxLength={100}
        />
        <TextField
          label="Название"
          value={name}
          onChange={setName}
          required
          maxLength={255}
        />
        <TextField
          label="Единица измерения"
          value={unit}
          onChange={setUnit}
          required
          maxLength={50}
        />
        <small>Номенклатура сохранится вместе с приходом.</small>
        {duplicate && (
          <Notice>
            Такой артикул уже существует: {duplicate.name}.
            {duplicate.isActive ? (
              <button
                type="button"
                className="admin-secondary-button"
                onClick={() => onSelect(duplicate)}
              >
                Выбрать существующую
              </button>
            ) : (
              " Позиция неактивна. Обратитесь к администратору."
            )}
          </Notice>
        )}
        {checked && check.error && <Notice tone="error">{check.error}</Notice>}
        <div className="admin-form-actions">
          <button
            type="button"
            className="admin-secondary-button"
            onClick={onClose}
          >
            Отмена
          </button>
          <button
            className="admin-primary-button"
            disabled={
              !checked ||
              !!check.error ||
              !!duplicate ||
              !article.trim() ||
              !name.trim() ||
              !unit.trim()
            }
          >
            Добавить в приход
          </button>
        </div>
      </form>
    </AdminModal>
  );
}
