import { useEffect, useId, useMemo, useState } from 'react';
import type { OptionItem } from '../api/equipment/equipment.types';

type SearchSelectProps = {
  error?: string;
  label: string;
  onFocus?: () => void;
  options: OptionItem[];
  placeholder?: string;
  required?: boolean;
  value: number | null;
  onChange: (value: number | null) => void;
};

export function SearchSelect({
  error,
  label,
  onChange,
  onFocus,
  options,
  placeholder = 'Начните вводить',
  required = false,
  value,
}: SearchSelectProps) {
  const inputId = useId();
  const listboxId = useId();
  const errorId = useId();
  const selectedOption = options.find((option) => option.id === value) ?? null;
  const [query, setQuery] = useState(selectedOption?.name ?? '');
  const [isOpen, setIsOpen] = useState(false);
  const [activeOptionIndex, setActiveOptionIndex] = useState(0);

  useEffect(() => {
    setQuery(selectedOption?.name ?? '');
  }, [selectedOption?.id, selectedOption?.name]);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return options.slice(0, 8);
    }

    return options
      .filter((option) =>
        `${option.name} ${option.position ?? ''}`
          .toLowerCase()
          .includes(normalizedQuery),
      )
      .slice(0, 8);
  }, [options, query]);

  useEffect(() => {
    setActiveOptionIndex((currentIndex) => {
      if (filteredOptions.length === 0) {
        return 0;
      }

      return Math.min(currentIndex, filteredOptions.length - 1);
    });
  }, [filteredOptions.length]);

  const selectOption = (option: OptionItem) => {
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
    <div className={`form-field search-select-field${error ? ' has-error' : ''}`}>
      <label htmlFor={inputId}>
        {label}
        {required ? <b aria-hidden="true">*</b> : null}
      </label>
      <input
        aria-activedescendant={isOpen ? activeOptionId : undefined}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-describedby={error ? errorId : undefined}
        aria-expanded={isOpen}
        aria-invalid={error ? "true" : undefined}
        id={inputId}
        onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
        onChange={(event) => {
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
      {isOpen && filteredOptions.length > 0 ? (
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
      {error ? (
        <small className="field-error" id={errorId}>
          {error}
        </small>
      ) : null}
    </div>
  );
}
