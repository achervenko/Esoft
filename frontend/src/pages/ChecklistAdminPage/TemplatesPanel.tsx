import { LoadingIndicator } from "../../shared/ui/LoadingIndicator";
import { Copy, FilePlus2, Trash2, Search, SlidersHorizontal, X } from "lucide-react";
import type { KeyboardEvent, MouseEvent } from "react";
import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import {
  checklistTemplateStateLabels,
  type ChecklistTemplateListItem,
} from "../../shared/api/checklists";
import { formatQuestionCount } from "../../shared/lib/formatters";
import { DataTable, type DataTableColumn } from "../../shared/ui/DataTable";
import { SelectDropdown } from "../../shared/ui/SelectDropdown";
import { templateStateOptions } from "./checklist-admin.constants";
import { AdminModal } from "../../shared/ui/AdminModal";
import "../../shared/ui/SearchInput.css";
import "../../shared/ui/SearchToolbar.css";

type TemplatesPanelProps = {
  isLoading: boolean;
  onArchive: (template: ChecklistTemplateListItem) => void;
  onCopy: (template: ChecklistTemplateListItem) => void;
  onCreate: () => void;
  onSearch: (next?: { search?: string; state?: string }) => void;
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
  state,
  templates,
}: TemplatesPanelProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const lastSearch = useRef(search);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (lastSearch.current === search) return;
    timer.current = setTimeout(() => { lastSearch.current = search; onSearch({ search }); }, 200);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [search, onSearch]);
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
    className: "admin-table-actions-column",
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
      <div className="search-input-shell">
        <Search size={18} aria-hidden="true" />
        <input
          aria-label="Поиск шаблонов по названию"
          onChange={(event) => setSearch(event.target.value)}
          value={search}
          onKeyDown={(event) => { if (event.key === "Enter") {
            event.preventDefault();
            if (timer.current) clearTimeout(timer.current);
            lastSearch.current = search;
            onSearch({ search });
          } }}
        />
        {search && <button type="button" className="ppe-journal-icon-button" aria-label="Очистить поиск" onClick={() => {
          if (timer.current) clearTimeout(timer.current);
          lastSearch.current = "";
          setSearch(""); onSearch({ search: "" });
        }}><X size={18} aria-hidden="true" /></button>}
        <button type="button" className={`ppe-journal-icon-button${state !== "ACTIVE" ? " ppe-journal-filter-active" : ""}`}
          aria-label="Фильтры шаблонов" aria-haspopup="dialog" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(true)}>
          <SlidersHorizontal size={20} aria-hidden="true" />
        </button>
      </div>
      {filtersOpen && <TemplateFiltersModal state={state} onClose={() => setFiltersOpen(false)} onApply={(nextState) => {
        onSearch({ state: nextState }); setFiltersOpen(false);
      }} />}
      <LoadingIndicator loading={isLoading} />
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

function TemplateFiltersModal({ state, onApply, onClose }: { state: string; onApply: (state: string) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(state);
  return <AdminModal title="Фильтры шаблонов" onClose={onClose}>
    <form className="admin-form" onSubmit={(event) => { event.preventDefault(); onApply(draft); }}>
      <SelectDropdown label="Состояние" value={draft} options={templateStateOptions} onChange={setDraft} />
      <div className="admin-form-actions">
        <button type="button" className="admin-secondary-button" onClick={() => setDraft("ACTIVE")}>Сбросить</button>
        <button type="submit" className="admin-primary-button">Применить</button>
      </div>
    </form>
  </AdminModal>;
}
