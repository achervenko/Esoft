import type {
  ChangeEvent,
  KeyboardEvent,
  RefObject,
} from "react";

type PdfPreviewSearchProps = {
  query: string;
  matchCount: number;
  activeMatchIndex: number;
  isIndexLoading: boolean;
  isDisabled: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onQueryChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onPrevious: () => void;
  onNext: () => void;
  onClear: () => void;
};

export function PdfPreviewSearch({
  query,
  matchCount,
  activeMatchIndex,
  isIndexLoading,
  isDisabled,
  inputRef,
  onQueryChange,
  onKeyDown,
  onPrevious,
  onNext,
  onClear,
}: PdfPreviewSearchProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onQueryChange(event.target.value);
  };

  const counter = (() => {
    if (isIndexLoading) {
      return "Индексация...";
    }

    if (!query.trim()) {
      return "";
    }

    if (matchCount === 0) {
      return "Ничего не найдено";
    }

    return `${activeMatchIndex + 1} / ${matchCount}`;
  })();

  return (
    <div className="pdf-preview-search">
      <input
        aria-label="Поиск по документу"
        className="pdf-preview-search-input"
        disabled={isDisabled}
        onChange={handleChange}
        onKeyDown={onKeyDown}
        placeholder="Найти в документе"
        ref={inputRef}
        type="search"
        value={query}
      />

      <span className="pdf-preview-search-counter">
        {counter}
      </span>

      <button
        aria-label="Предыдущее совпадение"
        className="pdf-preview-search-button"
        disabled={matchCount === 0}
        onClick={onPrevious}
        type="button"
      >
        ↑
      </button>

      <button
        aria-label="Следующее совпадение"
        className="pdf-preview-search-button"
        disabled={matchCount === 0}
        onClick={onNext}
        type="button"
      >
        ↓
      </button>

      <button
        aria-label="Очистить поиск"
        className="pdf-preview-search-button"
        disabled={!query}
        onClick={onClear}
        type="button"
      >
        ×
      </button>
    </div>
  );
}