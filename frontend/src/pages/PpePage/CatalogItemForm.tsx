import "../../modules/ppe-ui/PpeForm.css";
import { useRef, useState } from "react";
import { ApiRequestError } from "../../shared/api/api-error";
import { AppSelect } from "../../shared/ui/SelectDropdown/AppSelect";
import { ppeApi, type PpeItem, type PpeType } from "../../shared/api/ppe";
import { GuardedAdminModal } from "../../shared/ui/GuardedAdminModal";
import { useDraftChanges } from "../../shared/lib/use-draft-changes";
import { Field, Message } from "../../modules/ppe-ui/ppe-ui";
import { ppeError, typeLabels, ppeUnits } from "../../modules/ppe-ui/ppe-presentation";
import { SizeRange } from "./SizeRange";
import { shoeSizeRange, gloveSizeRange, headSizeRange } from "./size-range-options";
import { defaultShoeSizes, defaultGloveSizes, defaultHeadSizes } from "../../modules/ppe-ui/ppe-size-options";
import { ClothingSizeGrid } from "../../modules/ppe-ui/ClothingSizeGrid";
import { defaultClothingSizes, defaultTshirtSizes } from "../../modules/ppe-ui/ppe-size-options";

export function CatalogItemForm({
  item,
  items,
  onClose,
  onChanged,
}: {
  item: PpeItem | null;
  items: PpeItem[];
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
  const savingRef = useRef(false);
  const [sizeRows, setSizeRows] = useState<
    { value: string; heightValue: string }[]
  >(() => (!item ? defaultClothingSizes() : []));
  const hasChanges = useDraftChanges({
    data,
    sizeRows: sizeRows.map((row) => `${row.value};${row.heightValue}`).sort(),
  });
  const [error, setError] = useState<string | null>(null);
  const [articleConflict, setArticleConflict] = useState<string | null>(null);
  const article = data.article.trim();
  const duplicate = article
    ? items.find((candidate) => candidate.id !== item?.id && candidate.article === article)
    : undefined;
  const articleError = duplicate
    ? `Этот артикул уже используется: «${duplicate.name}».${duplicate.isActive ? "" : " Позиция неактивна."}`
    : articleConflict === article
      ? "СИЗ с таким артикулом уже существует."
      : undefined;
  const name = data.name.trim();
  const duplicateNames = name
    ? items.filter((candidate) => candidate.id !== item?.id && candidate.name.trim() === name)
    : [];
  const nameWarning = duplicateNames.length
    ? `Такое наименование уже есть. Артикулы: ${duplicateNames.map((candidate) => `${candidate.article}${candidate.isActive ? "" : " (позиция неактивна)"}`).join(", ")}.`
    : undefined;
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
          if (savingRef.current || articleError) return;
          savingRef.current = true;
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
                              (data.type === "BODY" || data.type === "TSHIRT")
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
            .catch((err) => {
              if (err instanceof ApiRequestError && err.code === "PPE_ITEM_ARTICLE_CONFLICT") {
                setArticleConflict(article);
              } else {
                setError(ppeError(err));
              }
            })
            .finally(() => {
              savingRef.current = false;
              setSaving(false);
            });
        }}
      >
        <div className="ppe-item-fields">
          {(["article", "name"] as const).map((key, index) => (
            <Field
              key={key}
              label={["Артикул", "Наименование", "Единица измерения"][index]}
              error={key === "article" ? articleError : undefined}
              warning={key === "name" ? nameWarning : undefined}
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
                if (!item && (type === "FEET" || type === "HANDS" || type === "HEAD")) {
                  setSizeRows(
                    (type === "FEET" ? defaultShoeSizes() : type === "HANDS" ? defaultGloveSizes() : defaultHeadSizes()).map((value) => ({
                      value,
                      heightValue: "",
                    })),
                  );
                } else if (!item && (type === "BODY" || type === "TSHIRT")) {
                  setSizeRows(type === "TSHIRT" ? defaultTshirtSizes() : defaultClothingSizes());
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
        {!item && (data.type === "FEET" || data.type === "HANDS" || data.type === "HEAD") && (
          <SizeRange
            {...(data.type === "FEET" ? shoeSizeRange : data.type === "HANDS" ? gloveSizeRange : headSizeRange)}
            values={sizeRows.map((size) => size.value)}
            disabled={saving}
            onChange={(values) =>
              setSizeRows(values.map((value) => ({ value, heightValue: "" })))
            }
          />
        )}
        {!item && (data.type === "BODY" || data.type === "TSHIRT") && (
          <ClothingSizeGrid
            variant={data.type === "TSHIRT" ? "tshirt" : "clothing"}
            values={sizeRows}
            onChange={setSizeRows}
            disabled={saving}
          />
        )}
        {item?.hasActiveNorm && (
          <Message>
            Чтобы применить изменения к действующей норме, создайте новую
            редакцию нормы.
          </Message>
        )}
        <Message error={error} />
        <div className="ppe-form-actions">
          <button className="admin-primary-button" disabled={saving || Boolean(articleError)}>
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </form>
    </GuardedAdminModal>
  );
}
