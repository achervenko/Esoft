import { Check, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./SelectDropdown.css";

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
  placeholder = "Выберите значение",
  required = false,
  value,
}: SelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  const selectOption = (option: SelectDropdownOption) => {
    onChange(option.value);
    setIsOpen(false);
  };

  const updateMenuPosition = () => {
    const trigger = triggerRef.current;

    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();

    setMenuStyle({
      left: rect.left,
      top: rect.bottom + 6,
      width: rect.width,
    });
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    updateMenuPosition();

    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen]);

  return (
    <label
      className={`form-field select-dropdown-field${error ? " has-error" : ""}`}
    >
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
          updateMenuPosition();
          setIsOpen((currentValue) => !currentValue);
        }}
        onFocus={onFocus}
        ref={triggerRef}
        type="button"
      >
        <span className={selectedOption ? undefined : "select-placeholder"}>
          {selectedOption?.label ?? placeholder}
        </span>
        <ChevronDown aria-hidden="true" size={18} />
      </button>

      {isOpen && menuStyle
        ? createPortal(
            <div className="select-dropdown-menu" style={menuStyle}>
              {options.map((option) => {
                const isSelected = option.value === value;

                return (
                  <button
                    className={isSelected ? "selected" : undefined}
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
            </div>,
            document.body,
          )
        : null}
      {error ? <small className="field-error">{error}</small> : null}
    </label>
  );
}
