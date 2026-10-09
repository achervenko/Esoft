import { useEffect } from "react";
import { AppSelect } from "../../shared/ui/SelectDropdown/AppSelect";
import { ppeApi, type PpeItem } from "../../shared/api/ppe";
import {
  formatPpeDate,
  formatPpeQuantity,
  sizeLabel,
} from "../../modules/ppe-ui/ppe-presentation";
import { Field, Message } from "../../modules/ppe-ui/ppe-ui";
import { usePpeQuery } from "../../modules/ppe-ui/usePpeQuery";
import { PpeQueryState } from "../../modules/ppe-ui/PpeQueryState";
import type { Draft } from "./issue-form-model";
export function IssueDraftRow({
  row,
  employeeId,
  items,
  disabled,
  onChange,
}: {
  row: Draft;
  employeeId: number;
  items: PpeItem[];
  disabled: boolean;
  onChange: (key: number, patch: Partial<Draft>, automatic?: boolean) => void;
}) {
  const recommendation = usePpeQuery(
    `size:${employeeId}:${row.ppeItemId}`,
    (signal) => ppeApi.recommendSize(employeeId, row.ppeItemId, signal),
    Boolean(row.ppeItemId),
  );
  useEffect(() => {
    const data = recommendation.data;
    onChange(
      row.key,
      {
        sizeId: data?.recommendedSizeId ? String(data.recommendedSizeId) : "",
        ready: Boolean(
          data && (!data.requiresSelection || data.activeSizes.length > 0),
        ),
        requiresSelection: data?.requiresSelection ?? false,
      },
      true,
    );
  }, [recommendation.data, row.key, onChange]);
  const data = recommendation.data;
  return (
    <fieldset className="ppe-issue-row" disabled={disabled}>
      {row.norm && <legend>{`${row.norm.article} — ${row.norm.name}`}</legend>}
      {row.norm && (
        <p>
          <strong>По норме:</strong> {row.norm.article} / {row.norm.name} ·{" "}
          {row.norm.available &&
            formatPpeQuantity(row.norm.available.quantity, row.norm.unit)}{" "}
          · нормативная дата {formatPpeDate(row.norm.available?.scheduledAt)}
        </p>
      )}
      <Field label="Выдаём фактически" hideLabel={!row.norm}>
        <AppSelect
          required
          value={row.ppeItemId || ""}
          onChange={(e) =>
            onChange(row.key, {
              ppeItemId: Number(e.target.value),
              sizeId: "",
              ready: false,
            })
          }
        >
          <option value="">Выберите СИЗ</option>
          {items
            .filter(
              (item) =>
                (item.isActive || item.id === row.ppeItemId) &&
                (!row.norm ||
                  (item.type === row.norm.type && item.unit === row.norm.unit)),
            )
            .map((item) => (
              <option key={item.id} value={item.id} disabled={!item.isActive}>
                {item.article} — {item.name}
                {!item.isActive ? " (отключён)" : ""}
              </option>
            ))}
        </AppSelect>
      </Field>
      {!row.norm && (
        <Field label="Количество">
          <input
            required
            type="number"
            min="0.001"
            max="999999999.999"
            step="0.001"
            value={row.quantity}
            onChange={(e) => onChange(row.key, { quantity: e.target.value })}
          />
        </Field>
      )}
      <PpeQueryState {...recommendation} />
      {data && (
        <>
          <p className="admin-form-hint">
            Рекомендуемый размер:{" "}
            {data.recommendedSizeId
              ? sizeLabel(
                  data.recommendedSizeValue,
                  data.recommendedHeightValue,
                )
              : "подходящего активного размера нет"}
          </p>
          {data.type !== "OTHER" && data.activeSizes.length > 0 ? (
            <Field
              label={
                data.type === "BODY"
                  ? "Фактический размер / ростовка"
                  : "Фактический размер"
              }
            >
              <AppSelect
                required={data.requiresSelection}
                value={row.sizeId}
                onChange={(e) => onChange(row.key, { sizeId: e.target.value })}
              >
                <option value="">Выберите размер</option>
                {data.activeSizes.map((size) => (
                  <option key={size.id} value={size.id}>
                    {sizeLabel(size.value, size.heightValue)}
                    {size.id === data.recommendedSizeId
                      ? " — рекомендуется"
                      : ""}
                  </option>
                ))}
              </AppSelect>
            </Field>
          ) : data.requiresSelection ? (
            <Message error="Все размеры отключены. Выдача этой позиции заблокирована до активации или добавления размера. Можно выбрать другой СИЗ." />
          ) : (
            <p>Выдача без размера.</p>
          )}
          <p className="admin-form-hint">
            Можно выбрать другой активный размер. Если он отличается от размера
            сотрудника, система покажет предупреждение после выдачи.
          </p>
        </>
      )}
      <Field label="Комментарий">
        <textarea
          maxLength={2000}
          value={row.comment}
          onChange={(e) => onChange(row.key, { comment: e.target.value })}
        />
      </Field>
    </fieldset>
  );
}
