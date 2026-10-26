import { Plus, Search, SlidersHorizontal, X } from "lucide-react";
import type { InputHTMLAttributes } from "react";
import "./SearchInput.css";
import "./SearchToolbar.css";

export function SearchToolbar({
  value,
  onChange,
  label,
  onCreate,
  createAriaLabel = "Добавить",
  createDisabled = false,
  filters,
  className = "",
  inputProps,
  onClear,
  clearLabel = `Очистить ${label.toLocaleLowerCase("ru")}`,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  onCreate?: () => void;
  createAriaLabel?: string;
  createDisabled?: boolean;
  className?: string;
  inputProps?: Pick<
    InputHTMLAttributes<HTMLInputElement>,
    "autoFocus" | "maxLength" | "onKeyDown"
  >;
  onClear?: () => void;
  clearLabel?: string;
  filters?: {
    label: string;
    count: number;
    onOpen: () => void;
    expanded?: boolean;
    controls?: string;
    title?: string;
  };
}) {
  return (
    <div
      className={`search-toolbar${onCreate ? " search-toolbar-with-action" : ""} ${className}`.trim()}
    >
      <div className="search-input-shell">
        <Search aria-hidden="true" size={18} />
        <input
          {...inputProps}
          type="search"
          aria-label={label}
          placeholder=""
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        {value && (
          <button
            type="button"
            className="search-toolbar-icon-button"
            aria-label={clearLabel}
            onClick={() => (onClear ? onClear() : onChange(""))}
          >
            <X aria-hidden="true" size={18} />
          </button>
        )}
        {filters && (
          <button
            type="button"
            className={`search-toolbar-icon-button${filters.count ? " search-toolbar-filter-active" : ""}`}
            aria-label={filters.label}
            title={filters.title ?? "Настройки поиска"}
            aria-haspopup="dialog"
            aria-expanded={filters.expanded}
            aria-controls={filters.controls}
            onClick={filters.onOpen}
          >
            <SlidersHorizontal aria-hidden="true" size={18} />
            {filters.count > 0 && (
              <span className="search-toolbar-filter-count">
                {filters.count}
              </span>
            )}
          </button>
        )}
      </div>
      {onCreate && (
        <button
          type="button"
          className="admin-primary-button"
          aria-label={createAriaLabel}
          disabled={createDisabled}
          onClick={onCreate}
        >
          <Plus aria-hidden="true" size={18} />
          Добавить
        </button>
      )}
    </div>
  );
}
