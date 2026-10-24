import { SearchSelectPopup } from "./SearchSelectPopup";
import { useSearchSelectPopup } from "./useSearchSelectPopup";
import { DialogPopupReadyContext } from "./DialogPopupReadyContext";
import { useDialogSearchFocus } from "./useDialogSearchFocus";
import { RequiredMark } from "./RequiredMark";
import {
  useContext,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import "./FormField.css";
import "./SearchInput.css";
import "./SearchSelect.css";
import type { OptionItem } from "../api/equipment/equipment.types";

type SearchSelectProps = {
  autoFocus?: boolean;
  focusOnMount?: boolean;
  disabled?: boolean;
  appearance?: "field" | "search";
  error?: string;
  noMatchError?: string;
  placement?: "auto" | "bottom";
  filterOption?: (option: OptionItem, query: string) => boolean;
  maxResults?: number | null;
  minQueryLength?: number;
  hideLabel?: boolean;
  icon?: ReactNode;
  emptyMessage?: string;
  className?: string;
  label: string;
  onFocus?: () => void;
  options: OptionItem[];
  required?: boolean;
  value: number | null;
  onChange: (value: number | null) => void;
};

export function SearchSelect({
  autoFocus = false,
  focusOnMount = false,
  disabled = false,
  appearance = "field",
  error: suppliedError,
  noMatchError,
  placement = "auto",
  filterOption,
  // If large lists become slow, enable maxResults for the affected fields.
  maxResults = null,
  minQueryLength = 0,
  hideLabel = false,
  icon,
  emptyMessage,
  className = "",
  label,
  onChange,
  onFocus,
  options,
  required = false,
  value,
}: SearchSelectProps) {
  const dialogReady = useContext(DialogPopupReadyContext);
  const { ref: focusRef, ready: focusReady } =
    useDialogSearchFocus(focusOnMount);
  const isDialogReady = dialogReady && focusReady;
  const inputRef = useRef<HTMLInputElement>(null);
  const setInputRef = useCallback(
    (input: HTMLInputElement | null) => {
      inputRef.current = input;
      focusRef(input);
    },
    [focusRef],
  );
  const inputId = useId();
  const listboxId = useId();
  const errorId = useId();
  const selectedOption = options.find((option) => option.id === value) ?? null;
  const [query, setQuery] = useState(selectedOption?.name ?? "");
  const [isOpen, setIsOpen] = useState(false);
  const [activeOptionIndex, setActiveOptionIndex] = useState(0);
  const isInternalClearRef = useRef(false);

  useEffect(() => {
    if (isInternalClearRef.current && value === null) {
      isInternalClearRef.current = false;
      return;
    }
    isInternalClearRef.current = false;
    setQuery(selectedOption?.name ?? "");
  }, [value, selectedOption?.id, selectedOption?.name]);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (normalizedQuery.length < minQueryLength) return [];
    const limit =
      maxResults === null ? Infinity : Math.max(0, Math.trunc(maxResults));
    if (!normalizedQuery)
      return maxResults === null ? options : options.slice(0, limit);
    const matches: OptionItem[] = [];
    if (limit === 0) return matches;
    for (const option of options) {
      const matchesQuery = filterOption
        ? filterOption(option, normalizedQuery)
        : (option.name + " " + (option.position ?? ""))
            .toLowerCase()
            .includes(normalizedQuery);
      if (matchesQuery) {
        matches.push(option);
        if (matches.length >= limit) break;
      }
    }
    return matches;
  }, [options, query, filterOption, maxResults, minQueryLength]);

  const normalizedQuery = query.trim();
  const error =
    (normalizedQuery.length >= minQueryLength &&
    normalizedQuery.length > 0 &&
    filteredOptions.length === 0
      ? noMatchError
      : undefined) ?? suppliedError;

  useEffect(() => {
    setActiveOptionIndex((currentIndex) => {
      if (filteredOptions.length === 0) {
        return 0;
      }

      return Math.min(currentIndex, filteredOptions.length - 1);
    });
  }, [filteredOptions.length]);

  const popup = useSearchSelectPopup({
    inputRef,
    isOpen,
    disabled,
    isDialogReady,
    placement,
    optionCount: filteredOptions.length,
  });

  const selectOption = (option: OptionItem) => {
    if (disabled) return;
    isInternalClearRef.current = false;
    setQuery(option.name);
    setIsOpen(false);
    setActiveOptionIndex(0);
    onChange(option.id);
  };

  const activeOption = filteredOptions[activeOptionIndex] ?? null;
  const isListboxVisible =
    isDialogReady &&
    !disabled &&
    isOpen &&
    query.trim().length >= minQueryLength &&
    filteredOptions.length > 0 &&
    popup !== null;
  const isEmptyStateVisible =
    isDialogReady &&
    !disabled &&
    isOpen &&
    query.trim().length >= minQueryLength &&
    filteredOptions.length === 0 &&
    Boolean(emptyMessage) &&
    popup !== null;
  const activeOptionId = activeOption
    ? `${listboxId}-option-${activeOption.id}`
    : undefined;

  const moveActiveOption = (direction: 1 | -1) => {
    if (filteredOptions.length === 0) {
      return;
    }

    setIsOpen(true);
    setActiveOptionIndex((currentIndex) => {
      const nextIndex = currentIndex + direction;

      if (nextIndex < 0) {
        return filteredOptions.length - 1;
      }

      if (nextIndex >= filteredOptions.length) {
        return 0;
      }

      return nextIndex;
    });
  };

  return (
    <div
      className={`${appearance === "search" ? "search-select-search" : "form-field"} search-select-field ${className}${error ? " has-error" : ""}`}
    >
      <label
        htmlFor={inputId}
        className={`form-field-label${hideLabel ? " search-select-label-hidden" : ""}`}
      >
        {label}
        {required ? <RequiredMark /> : null}
      </label>
      <div
        className={
          appearance === "search"
            ? "search-input-shell"
            : icon
              ? "search-select-input-with-icon"
              : undefined
        }
      >
        {icon}
        <input
          ref={setInputRef}
          autoFocus={autoFocus}
          disabled={disabled}
          aria-activedescendant={isListboxVisible ? activeOptionId : undefined}
          aria-autocomplete="list"
          aria-controls={isListboxVisible ? listboxId : undefined}
          aria-describedby={error ? errorId : undefined}
          aria-expanded={isListboxVisible}
          aria-invalid={error ? "true" : undefined}
          id={inputId}
          onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
          onChange={(event) => {
            isInternalClearRef.current = value !== null;
            setQuery(event.target.value);
            setIsOpen(true);
            setActiveOptionIndex(0);
            onChange(null);
          }}
          onFocus={() => {
            onFocus?.();
            setIsOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              moveActiveOption(1);
              return;
            }

            if (event.key === "ArrowUp") {
              event.preventDefault();
              moveActiveOption(-1);
              return;
            }

            if (event.key === "Enter" && isListboxVisible && activeOption) {
              event.preventDefault();
              selectOption(activeOption);
              return;
            }

            if (
              event.key === "Escape" &&
              (isListboxVisible || isEmptyStateVisible)
            ) {
              event.preventDefault();
              event.stopPropagation();
              setIsOpen(false);
              setActiveOptionIndex(0);
            }
          }}
          role="combobox"
          type="text"
          value={query}
        />
      </div>
      <SearchSelectPopup
        popup={popup}
        isListboxVisible={isListboxVisible}
        isEmptyStateVisible={isEmptyStateVisible}
        listboxId={listboxId}
        filteredOptions={filteredOptions}
        value={value}
        activeOptionId={activeOption?.id}
        emptyMessage={emptyMessage}
        onSelect={selectOption}
        onActiveOptionChange={setActiveOptionIndex}
      />
      {error ? (
        <small className="field-error" id={errorId}>
          {error}
        </small>
      ) : null}
    </div>
  );
}
