import { Check, ChevronDown } from 'lucide-react';
import { useMemo, useState } from 'react';

export type SelectDropdownOption = {
  label: string;
  value: string;
};

type SelectDropdownProps = {
  error?: string;
  label: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  options: SelectDropdownOption[];
  placeholder?: string;
  required?: boolean;
  value: string;
};

export function SelectDropdown({
  error,
  label,
  onChange,
  onFocus,
  options,
  placeholder = 'Выберите значение',
  required = false,
  value,
}: SelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  const selectOption = (option: SelectDropdownOption) => {
    onChange(option.value);
    setIsOpen(false);
  };

  return (
    <label className={`form-field select-dropdown-field${error ? ' has-error' : ''}`}>
      <span>
        {label}
        {required ? <b aria-hidden="true">*</b> : null}
      </span>

      <button
        aria-expanded={isOpen}
        className="select-dropdown-trigger"
        onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
        onClick={() => {
          onFocus?.();
          setIsOpen((currentValue) => !currentValue);
        }}
        onFocus={onFocus}
        type="button"
      >
        <span className={selectedOption ? undefined : 'select-placeholder'}>
          {selectedOption?.label ?? placeholder}
        </span>
        <ChevronDown aria-hidden="true" size={18} />
      </button>

      {isOpen ? (
        <div className="select-dropdown-menu">
          {options.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                className={isSelected ? 'selected' : undefined}
                key={option.value}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectOption(option)}
                type="button"
              >
                <span>{option.label}</span>
                {isSelected ? <Check aria-hidden="true" size={17} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
      {error ? <small className="field-error">{error}</small> : null}
    </label>
  );
}
