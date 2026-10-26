import { AdminTextField as TextField } from "../../shared/ui/AdminFormControls";
import { useId, useState } from "react";
import { AdminModal } from "../../shared/ui/AdminModal";
import { AppSelect } from "../../shared/ui/SelectDropdown/AppSelect";
import { Field } from "../../modules/ppe-ui/ppe-ui";
import { typeLabels } from "../../modules/ppe-ui/ppe-presentation";
import { emptyCatalogFilters, type CatalogFilters } from "./catalog-filtering";

type CatalogFiltersModalProps = {
  filters: CatalogFilters;
  heightOptions: string[];
  onApply: (filters: CatalogFilters) => void;
  onClose: () => void;
};
export function CatalogFiltersModal({
  filters,
  heightOptions,
  onApply,
  onClose,
}: CatalogFiltersModalProps) {
  const [draftFilters, setDraftFilters] = useState(filters);
  const heightListId = useId();
  return (
    <AdminModal
      title="Фильтры номенклатуры"
      className="ppe-journal-filter-modal"
      onClose={onClose}
    >
      <form
        className="ppe-filter-grid ppe-journal-filters"
        onSubmit={(e) => {
          e.preventDefault();
          onApply({
            ...draftFilters,
            size: draftFilters.size.trim(),
            height:
              draftFilters.type === "BODY" || draftFilters.type === "TSHIRT"
                ? draftFilters.height.trim()
                : "",
          });
        }}
      >
        <Field label="Тип СИЗ">
          <AppSelect
            value={draftFilters.type}
            onChange={(e) =>
              setDraftFilters({
                ...draftFilters,
                type: e.target.value,
                height:
                  e.target.value === "BODY" || e.target.value === "TSHIRT"
                    ? draftFilters.height
                    : "",
              })
            }
          >
            <option value="">Все типы</option>
            {Object.entries(typeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </AppSelect>
        </Field>
        <Field label="Статус">
          <AppSelect
            value={draftFilters.status}
            onChange={(e) =>
              setDraftFilters({ ...draftFilters, status: e.target.value })
            }
          >
            <option value="">Все</option>
            <option value="true">Активные</option>
            <option value="false">Удалённые</option>
          </AppSelect>
        </Field>
        <TextField
          fieldClassName="ppe-field"
          label="Размер"
          value={draftFilters.size}
          onChange={(value) =>
            setDraftFilters({ ...draftFilters, size: value })
          }
        />
        {(draftFilters.type === "BODY" || draftFilters.type === "TSHIRT") && (
          <Field label="Ростовка">
            <input
              list={heightListId}
              value={draftFilters.height}
              onChange={(e) =>
                setDraftFilters({ ...draftFilters, height: e.target.value })
              }
            />
            <datalist id={heightListId}>
              {heightOptions.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </Field>
        )}
        <Field label="В действующих нормах">
          <AppSelect
            value={draftFilters.inNorm}
            onChange={(e) =>
              setDraftFilters({ ...draftFilters, inNorm: e.target.value })
            }
          >
            <option value="">Все</option>
            <option value="true">Используется</option>
            <option value="false">Не используется</option>
          </AppSelect>
        </Field>
        <div className="ppe-actions">
          <button className="admin-primary-button">Применить</button>
          <button
            type="button"
            className="admin-secondary-button"
            onClick={() => {
              onApply({ ...emptyCatalogFilters });
            }}
          >
            Сбросить
          </button>
        </div>
      </form>
    </AdminModal>
  );
}
