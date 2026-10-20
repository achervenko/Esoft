import { Search } from "lucide-react";
import { SearchSelect } from "../../shared/ui/SearchSelect";
import { useLayoutEffect, useState } from "react";
import { AppSelect } from "../../shared/ui/SelectDropdown/AppSelect";
import { ppeApi, type PpeItem } from "../../shared/api/ppe";
import { sizeLabel } from "../../modules/ppe-ui/ppe-presentation";
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
  const [commentExpanded, setCommentExpanded] = useState(Boolean(row.comment));
  const recommendation = usePpeQuery(
    `size:${employeeId}:${row.ppeItemId}`,
    (signal) => ppeApi.recommendSize(employeeId, row.ppeItemId, signal),
    Boolean(row.ppeItemId),
  );
  useLayoutEffect(() => {
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
      <SearchSelect
        label={row.norm ? "Выдаём фактически" : "СИЗ"}
        hideLabel={!row.norm}
        required
        disabled={disabled}
        icon={<Search size={18} aria-hidden="true" />}
        emptyMessage="СИЗ не найдены"
        maxResults={null}
        value={row.ppeItemId || null}
        options={items
          .filter((item) => item.isActive && (!row.norm ||
            (item.type === row.norm.type && item.unit === row.norm.unit)))
          .map((item) => ({ id: item.id, name: `${item.article} — ${item.name}` }))}
        onChange={(id) => {
          if (row.norm && id !== null && id !== row.norm.ppeItemId) setCommentExpanded(true);
          onChange(row.key, {
          ppeItemId: id ?? 0,
          sizeId: "",
          ready: false,
          });
        }}
      />
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
      <div className={`ppe-issue-size-block${data?.requiresSelection && !row.sizeId && !recommendation.loading ? " ppe-issue-size-missing" : ""}`} aria-busy={recommendation.loading}>
      <PpeQueryState {...recommendation} />
      {data && (
        <>
          {data.type !== "OTHER" && data.activeSizes.length > 0 ? (
            <Field
              label={
                (data.type === "BODY" || data.type === "TSHIRT")
                  ? "Размер / ростовка"
                  : "Размер"
              }
            >
              <AppSelect
                required={data.requiresSelection}
                value={row.sizeId}
                onChange={(e) => {
                  if (row.norm && e.target.value !== row.sizeId) setCommentExpanded(true);
                  onChange(row.key, { sizeId: e.target.value });
                }}
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
            <Message error="Все размеры удалены. Выдача этой позиции заблокирована до активации или добавления размера. Можно выбрать другой СИЗ." />
          ) : (
            <p>Выдача без размера.</p>
          )}
        </>
      )}
      </div>
      {row.norm && (
        <button type="button" className="admin-secondary-button ppe-comment-toggle"
          aria-expanded={commentExpanded} onClick={() => setCommentExpanded((current) => !current)}>
          {commentExpanded ? "Скрыть комментарий" : "Добавить комментарий"}
        </button>
      )}
      <div className={`ppe-employee-clothing-picker${!row.norm || commentExpanded ? " is-expanded" : ""}`}
        aria-hidden={Boolean(row.norm) && !commentExpanded} inert={Boolean(row.norm) && !commentExpanded}>
        <div className="ppe-employee-clothing-picker-clip">
          <div className="ppe-employee-clothing-picker-content">
      <Field label="Комментарий">
        <textarea
          maxLength={2000}
          value={row.comment}
          onChange={(e) => onChange(row.key, { comment: e.target.value })}
        />
      </Field>
          </div>
        </div>
      </div>
    </fieldset>
  );
}
