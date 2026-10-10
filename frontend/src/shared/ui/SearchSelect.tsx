import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import "./FormField.css";
import "./SearchInput.css";
import "./SearchSelect.css";
import type { OptionItem } from "../api/equipment/equipment.types";

type SearchSelectProps = {
  autoFocus?: boolean;
  disabled?: boolean;
  appearance?: "field" | "search";
  error?: string;
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
  placeholder?: string;
  required?: boolean;
  value: number | null;
  onChange: (value: number | null) => void;
};

export function SearchSelect({
  autoFocus = false,
  disabled = false,
  appearance = "field",
  error,
  filterOption,
  maxResults = 8,
  minQueryLength = 0,
  hideLabel = false,
  icon,
  emptyMessage,
  className = "",
  label,
  onChange,
  onFocus,
  options,
  placeholder = "Начните вводить",
  required = false,
  value,
}: SearchSelectProps) {
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
    const matches = normalizedQuery
      ? options.filter((option) =>
          filterOption
            ? filterOption(option, normalizedQuery)
            : (option.name + " " + (option.position ?? ""))
                .toLowerCase()
                .includes(normalizedQuery),
        )
      : options;
    return maxResults === null ? matches : matches.slice(0, maxResults);
  }, [options, query, filterOption, maxResults, minQueryLength]);

  useEffect(() => {
    setActiveOptionIndex((currentIndex) => {
      if (filteredOptions.length === 0) {
        return 0;
      }

      return Math.min(currentIndex, filteredOptions.length - 1);
    });
  }, [filteredOptions.length]);

  const selectOption = (option: OptionItem) => {
    if (disabled) return;
    isInternalClearRef.current = false;
    setQuery(option.name);
    setIsOpen(false);
    setActiveOptionIndex(0);
    onChange(option.id);
  };

  const activeOption = filteredOptions[activeOptionIndex] ?? null;
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
        className={hideLabel ? "search-select-label-hidden" : undefined}
      >
        {label}
        {required ? <b aria-hidden="true">*</b> : null}
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
          autoFocus={autoFocus}
          disabled={disabled}
          aria-activedescendant={isOpen ? activeOptionId : undefined}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-describedby={error ? errorId : undefined}
          aria-expanded={isOpen}
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

            if (event.key === "Enter" && isOpen && activeOption) {
              event.preventDefault();
              selectOption(activeOption);
              return;
            }

            if (event.key === "Escape") {
              setIsOpen(false);
              setActiveOptionIndex(0);
            }
          }}
          placeholder={placeholder}
          role="combobox"
          type="text"
          value={query}
        />
      </div>
      {!disabled && isOpen &&
      query.trim().length >= minQueryLength &&
      filteredOptions.length > 0 ? (
        <div className="search-select-menu" id={listboxId} role="listbox">
          {filteredOptions.map((option, optionIndex) => (
            <div
              aria-selected={option.id === value}
              className={`search-select-option${option.id === activeOption?.id ? " active" : ""}`}
              id={`${listboxId}-option-${option.id}`}
              key={option.id}
              onClick={() => selectOption(option)}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveOptionIndex(optionIndex)}
              role="option"
              tabIndex={-1}
            >
              <span>{option.name}</span>
              {option.position ? <small>{option.position}</small> : null}
            </div>
          ))}
        </div>
      ) : null}
      {!disabled && isOpen &&
      query.trim().length >= minQueryLength &&
      filteredOptions.length === 0 &&
      emptyMessage ? (
        <div className="search-select-menu" role="status">
          {emptyMessage}
        </div>
      ) : null}
      {error ? (
        <small className="field-error" id={errorId}>
          {error}
        </small>
      ) : null}
    </div>
  );
}
