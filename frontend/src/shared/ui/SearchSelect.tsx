import { useMemo, useState } from 'react';
import type { OptionItem } from '../api/equipment-api';

type SearchSelectProps = {
  label: string;
  options: OptionItem[];
  placeholder?: string;
  required?: boolean;
  value: number | null;
  onChange: (value: number | null) => void;
};

export function SearchSelect({
  label,
  onChange,
  options,
  placeholder = 'Начните вводить',
  required = false,
  value,
}: SearchSelectProps) {
  const selectedOption = options.find((option) => option.id === value) ?? null;
  const [query, setQuery] = useState(selectedOption?.name ?? '');
  const [isOpen, setIsOpen] = useState(false);

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

  const selectOption = (option: OptionItem) => {
    setQuery(option.name);
    setIsOpen(false);
    onChange(option.id);
  };

  return (
    <label className="form-field search-select-field">
      <span>
        {label}
        {required ? <b aria-hidden="true">*</b> : null}
      </span>
      <input
        onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
          onChange(null);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        type="text"
        value={query}
      />
      {isOpen && filteredOptions.length > 0 ? (
        <div className="search-select-menu">
          {filteredOptions.map((option) => (
            <button
              key={option.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectOption(option)}
              type="button"
            >
              <span>{option.name}</span>
              {option.position ? <small>{option.position}</small> : null}
            </button>
          ))}
        </div>
      ) : null}
    </label>
  );
}
