import type { FormEventHandler, ReactNode } from "react";
import { AdminModal } from "../../shared/ui/AdminModal";
import { Notice } from "../../shared/ui/Notice";
import { TextareaField } from "../../shared/ui/TextField";
import { WarehouseItemIdentity } from "../../shared/warehouse/WarehouseItemIdentity";
import { formatStockQuantity } from "../../shared/lib/warehouse-quantity";
import type { useReservationOperation } from "./useReservationOperation";

export function ReservationOperationModal({
  title,
  form,
  onClose,
  onRefresh,
  onSubmit,
  children,
  commentRequired,
  placeError,
  retryPlaces,
  blockSave,
}: {
  title: string;
  form: ReturnType<typeof useReservationOperation>;
  onClose: () => void;
  onRefresh: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  children: ReactNode;
  commentRequired: boolean;
  placeError: string | null;
  retryPlaces: () => void;
  blockSave: boolean;
}) {
  return (
    <AdminModal title={title} onClose={onClose} isCloseDisabled={form.saving}>
      <form
        className="admin-form reservation-operation-form"
        onSubmit={onSubmit}
      >
        {form.r && (
          <WarehouseItemIdentity
            name={form.r.item.name}
            article={form.r.item.article}
          />
        )}
        {form.source && (
          <p>
            Откуда: {form.source.location.warehouse.name} —{" "}
            {form.source.location.name} (
            {formatStockQuantity(form.source.quantity)} {form.r?.item.unit})
          </p>
        )}
        {form.pendingReserve && (
          <Notice>
            Подтвердите результат предыдущего запроса на{" "}
            {formatStockQuantity(form.pendingReserve.quantity)}. При повторе
            резерв будет создан или увеличен только один раз.
          </Notice>
        )}
        <fieldset disabled={form.locked} hidden={!!form.pendingReserve}>
          {children}
          <TextareaField
            label="Комментарий"
            required={commentRequired}
            maxLength={4000}
            value={form.comment}
            onChange={form.setComment}
          />
        </fieldset>
        {!form.pendingReserve && placeError && (
          <Notice tone="error">
            {placeError}
            <button type="button" onClick={retryPlaces}>
              Повторить загрузку мест
            </button>
          </Notice>
        )}
        {form.error && <Notice tone="error">{form.error}</Notice>}
        {form.uncertain && (
          <Notice>
            Ответ не получен. Операция могла выполниться. Получите актуальные
            данные перед дальнейшими действиями; повторная отправка
            заблокирована.
          </Notice>
        )}
        {form.error && !form.saving && !form.pendingReserve && (
          <button
            type="button"
            className="admin-secondary-button"
            onClick={onRefresh}
          >
            Обновить данные резервов
          </button>
        )}
        <div className="admin-form-actions">
          <button
            type="button"
            className="admin-secondary-button"
            disabled={form.saving}
            onClick={onClose}
          >
            Отмена
          </button>
          <button
            type="submit"
            className="admin-primary-button"
            disabled={
              form.saving ||
              form.uncertain ||
              !form.valid ||
              (!form.pendingReserve && blockSave)
            }
          >
            {form.saving
              ? "Сохранение…"
              : form.pendingReserve
                ? "Повторить сохранение"
                : "Сохранить"}
          </button>
        </div>
      </form>
    </AdminModal>
  );
}
