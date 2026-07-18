import { Copy, FilePlus2, Trash2 } from "lucide-react";
import type { KeyboardEvent, MouseEvent } from "react";
import { useCallback, useMemo } from "react";
import {
  checklistTemplateStateLabels,
  type ChecklistTemplateListItem,
} from "../../shared/api/checklists";
import { formatQuestionCount } from "../../shared/lib/formatters";
import { DataTable, type DataTableColumn } from "../../shared/ui/DataTable";
import { SelectDropdown } from "../../shared/ui/SelectDropdown";
import { templateStateOptions } from "./checklist-admin.constants";
import { Filters } from "./checklist-admin-ui";

type TemplatesPanelProps = {
  isLoading: boolean;
  onArchive: (template: ChecklistTemplateListItem) => void;
  onCopy: (template: ChecklistTemplateListItem) => void;
  onCreate: () => void;
  onSearch: () => void;
  search: string;
  setSearch: (value: string) => void;
  setState: (value: string) => void;
  state: string;
  templates: ChecklistTemplateListItem[];
};

export function TemplatesPanel({
  isLoading,
  onArchive,
  onCopy,
  onCreate,
  onSearch,
  search,
  setSearch,
  setState,
  state,
  templates,
}: TemplatesPanelProps) {
  const stopRowOpen = useCallback((
    event: KeyboardEvent<HTMLButtonElement> | MouseEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation();
  }, []);

  const openTemplate = useCallback((template: ChecklistTemplateListItem) => {
    window.location.hash = `#/checklist-admin/templates/${template.id}`;
  }, []);
  const hasActiveFilters = search.trim().length > 0 || state !== "ACTIVE";

  const columns = useMemo<Array<DataTableColumn<ChecklistTemplateListItem, string>>>(
    () => [
      {
        key: "name",
        label: "Шаблон",
        render: (template) => (
          <span className="checklist-admin-template-title">
            <strong>{template.name}</strong>
          </span>
        ),
        sortValue: (template) => template.name,
      },
      {
        key: "state",
        label: "Статус",
        render: (template) => (
          <span
            className={`checklist-admin-status ${template.state.toLowerCase()}`}
          >
            {checklistTemplateStateLabels[template.state]}
          </span>
        ),
        sortValue: (template) => template.state,
      },
      {
        key: "questions",
        label: "Вопросы",
        render: (template) => formatQuestionCount(template.questionCount),
        sortValue: (template) => template.questionCount,
      },
      {
        key: "actions",
        isSortable: false,
        label: "",
        render: (template) => (
          <div className="admin-table-actions">
            <button
              aria-label={`Копировать шаблон ${template.name}`}
              className="admin-icon-button"
              onClick={(event) => {
                event.stopPropagation();
                onCopy(template);
              }}
              onKeyDown={stopRowOpen}
              title="Копировать"
              type="button"
            >
              <Copy size={17} />
            </button>
            {template.state === "ACTIVE" ? (
              <button
                aria-label={`Удалить шаблон ${template.name}`}
                className="admin-icon-button"
                onClick={(event) => {
                  event.stopPropagation();
                  onArchive(template);
                }}
                onKeyDown={stopRowOpen}
                title="Удалить"
                type="button"
              >
                <Trash2 size={17} />
              </button>
            ) : null}
          </div>
        ),
      },
    ],
    [onArchive, onCopy, stopRowOpen],
  );

  return (
    <>
      <header>
        <h2>Шаблоны</h2>
        <button className="admin-primary-button" onClick={onCreate} type="button">
          <FilePlus2 size={18} />
          Создать шаблон
        </button>
      </header>
      <Filters onSearch={onSearch}>
        <input
          aria-label="Поиск шаблонов по названию"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Поиск по названию"
          value={search}
        />
        <SelectDropdown
          onChange={setState}
          options={templateStateOptions}
          value={state}
        />
      </Filters>
      {isLoading ? <p className="admin-state">Загрузка...</p> : null}
      {!isLoading && templates.length === 0 ? (
        <p className="admin-state">
          {hasActiveFilters
            ? "По заданным фильтрам шаблоны не найдены."
            : "Шаблоны чек-листов ещё не созданы."}
        </p>
      ) : null}
      {!isLoading && templates.length > 0 ? (
        <DataTable
          columns={columns}
          defaultSort={{ direction: "asc", key: "name" }}
          getRowKey={(template) => template.id}
          onRowClick={openTemplate}
          rows={templates}
        />
      ) : null}
    </>
  );
}
