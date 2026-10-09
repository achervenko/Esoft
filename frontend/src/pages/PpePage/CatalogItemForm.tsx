import { useState } from "react";
import { Trash2 } from "lucide-react";
import { normalizePpeSizeText } from "../../shared/lib/ppe-size-text";
import { AppSelect } from "../../shared/ui/SelectDropdown/AppSelect";
import { ppeApi, type PpeItem, type PpeType } from "../../shared/api/ppe";
import { GuardedAdminModal } from "../../shared/ui/GuardedAdminModal";
import { useDraftChanges } from "../../shared/lib/use-draft-changes";
import { Field, Message } from "../../modules/ppe-ui/ppe-ui";
import { ppeError, typeLabels, ppeUnits } from "../../modules/ppe-ui/ppe-presentation";
import { ShoeSizeRange } from "./ShoeSizeRange";
import { defaultShoeSizes } from "./ppe-size-options";
import { ClothingSizeGrid } from "./ClothingSizeGrid";
import { defaultClothingSizes } from "./ppe-size-options";

export function CatalogItemForm({
  item,
  onClose,
  onChanged,
}: {
  item: PpeItem | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [data, setData] = useState({
    article: item?.article ?? "",
    name: item?.name ?? "",
    unit: item?.unit ?? "шт",
    type: item?.type ?? ("BODY" as PpeType),
  });
  const [saving, setSaving] = useState(false);
  const [sizeRows, setSizeRows] = useState<
    { value: string; heightValue: string }[]
  >(() => (!item ? defaultClothingSizes() : []));
  const hasChanges = useDraftChanges({
    data,
    sizeRows: sizeRows.map((row) => `${row.value};${row.heightValue}`).sort(),
  });
  const [error, setError] = useState<string | null>(null);
  return (
    <GuardedAdminModal
      hasChanges={hasChanges}
      title={item ? "Редактирование СИЗ" : "Новый СИЗ"}
      onClose={onClose}
      isCloseDisabled={saving}
      className="ppe-clothing-modal ppe-item-form-modal"
    >
      <form
        className="ppe-form"
        onSubmit={(e) => {
          e.preventDefault();
          setSaving(true);
          setError(null);
          void ppeApi
            .saveItem(item?.id ?? null, {
              ...data,
              ...(!item
                ? {
                    sizes:
                      data.type === "OTHER"
                        ? []
                        : sizeRows.map((size) => ({
                            value:
                              data.type === "BODY"
                                ? `${size.value};${size.heightValue}`
                                : size.value,
                          })),
                  }
                : {}),
            })
            .then(() => {
              onChanged();
              onClose();
            })
            .catch((err) => setError(ppeError(err)))
            .finally(() => setSaving(false));
        }}
      >
        <div className="ppe-item-fields">
          {(["article", "name"] as const).map((key, index) => (
            <Field
              key={key}
              label={["Артикул", "Наименование", "Единица измерения"][index]}
            >
              <input
                required
                value={data[key]}
                disabled={saving}
                onChange={(e) => setData({ ...data, [key]: e.target.value })}
              />
            </Field>
          ))}
          <Field label="Тип">
            <AppSelect
              value={data.type}
              disabled={saving}
              onChange={(e) => {
                const type = e.target.value as PpeType;
                setData({
                  ...data,
                  type,
                  unit: type === "FEET" || type === "HANDS" ? "пары" : "шт",
                });
                if (!item && type === "FEET") {
                  setSizeRows(
                    defaultShoeSizes().map((value) => ({
                      value,
                      heightValue: "",
                    })),
                  );
                } else if (!item && type === "BODY") {
                  setSizeRows(defaultClothingSizes());
                } else if (type !== data.type) {
                  setSizeRows([]);
                }
              }}
            >
              {Object.entries(typeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </AppSelect>
          </Field>
          <Field label="Единица измерения">
            <AppSelect
              value={data.unit}
              disabled={saving}
              onChange={(e) => setData({ ...data, unit: e.target.value })}
            >
              {ppeUnits.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </AppSelect>
          </Field>
        </div>
        {!item && data.type === "FEET" && (
          <ShoeSizeRange
            values={sizeRows.map((size) => size.value)}
            disabled={saving}
            onChange={(values) =>
              setSizeRows(values.map((value) => ({ value, heightValue: "" })))
            }
          />
        )}
        {!item && data.type === "BODY" && (
          <ClothingSizeGrid
            values={sizeRows}
            onChange={setSizeRows}
            disabled={saving}
          />
        )}
        {!item &&
          data.type !== "OTHER" &&
          data.type !== "FEET" &&
          data.type !== "BODY" && (
            <fieldset disabled={saving} className="ppe-form">
              <legend>Доступные размеры</legend>
              {sizeRows.map((size, index) => (
                <div className="ppe-actions" key={index}>
                  <Field label={`Размер ${index + 1}`} hideLabel>
                    <input
                      required
                      maxLength={20}
                      value={size.value}
                      onChange={(e) =>
                        setSizeRows(
                          sizeRows.map((row, i) =>
                            i === index
                              ? {
                                  ...row,
                                  value: normalizePpeSizeText(e.target.value),
                                }
                              : row,
                          ),
                        )
                      }
                    />
                  </Field>
                  <button
                    type="button"
                    className="admin-icon-button"
                    aria-label={`Удалить размер ${index + 1}`}
                    title="Удалить размер"
                    onClick={() =>
                      setSizeRows(sizeRows.filter((_, i) => i !== index))
                    }
                  >
                    <Trash2 aria-hidden="true" size={17} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="admin-secondary-button"
                onClick={() =>
                  setSizeRows([...sizeRows, { value: "", heightValue: "" }])
                }
              >
                Добавить размер
              </button>
            </fieldset>
          )}
        {item?.hasActiveNorm && (
          <Message>
            Чтобы применить изменения к действующей норме, создайте новую
            редакцию нормы.
          </Message>
        )}
        <Message error={error} />
        <button className="admin-primary-button" disabled={saving}>
          {saving ? "Сохранение..." : "Сохранить"}
        </button>
      </form>
    </GuardedAdminModal>
  );
}
