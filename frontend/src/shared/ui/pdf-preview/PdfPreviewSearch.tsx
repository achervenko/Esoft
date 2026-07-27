import type {
  ChangeEvent,
  KeyboardEvent,
  RefObject,
} from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";

type PdfPreviewSearchProps = {
  isOpen: boolean;
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
  onClose: () => void;
};

export function PdfPreviewSearch({
  isOpen,
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
  onClose,
}: PdfPreviewSearchProps) {
  if (!isOpen) {
    return null;
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onQueryChange(event.target.value);
  };

  const getCounter = () => {
    if (isIndexLoading) {
      return "Загрузка...";
    }

    if (!query.trim()) {
      return "";
    }

    if (matchCount === 0) {
      return "0 / 0";
    }

    return `${activeMatchIndex + 1} / ${matchCount}`;
  };

  return (
    <div
      aria-label="Поиск по документу"
      className="pdf-preview-search"
      role="search"
    >
      <input
        aria-label="Введите текст для поиска"
        autoComplete="off"
        className="pdf-preview-search-input"
        disabled={isDisabled}
        onChange={handleChange}
        onKeyDown={onKeyDown}
        placeholder="Найти"
        ref={inputRef}
        spellCheck={false}
        type="text"
        value={query}
      />

      <span className="pdf-preview-search-counter">
        {getCounter()}
      </span>

      <button
        aria-label="Предыдущее совпадение"
        className="pdf-preview-search-button"
        disabled={matchCount === 0}
        onClick={onPrevious}
        title="Предыдущее совпадение"
        type="button"
      >
        <ChevronUp aria-hidden="true" size={17} strokeWidth={2} />
      </button>

      <button
        aria-label="Следующее совпадение"
        className="pdf-preview-search-button"
        disabled={matchCount === 0}
        onClick={onNext}
        title="Следующее совпадение"
        type="button"
      >
        <ChevronDown aria-hidden="true" size={17} strokeWidth={2} />
      </button>

      <button
        aria-label="Закрыть поиск"
        className="pdf-preview-search-button pdf-preview-search-close"
        onClick={onClose}
        title="Закрыть"
        type="button"
      >
        <X aria-hidden="true" size={18} strokeWidth={2} />
      </button>
    </div>
  );
}
