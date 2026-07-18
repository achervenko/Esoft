import { ChevronDown } from "lucide-react";
import { SelectDropdownMenu } from "./SelectDropdownMenu";
import { useSelectDropdown } from "./useSelectDropdown";
import type { SelectDropdownProps } from "./select-dropdown.types";
import "./SelectDropdown.css";

export function SelectDropdown({
  disabled = false,
  error,
  label,
  onChange,
  onFocus,
  options,
  placeholder = "Выберите значение",
  required = false,
  value,
}: SelectDropdownProps) {
  const dropdown = useSelectDropdown({
    disabled,
    onChange,
    options,
    value,
  });

  return (
    <label
      className={`form-field select-dropdown-field${error ? " has-error" : ""}`}
    >
      {label ? (
        <span>
          {label}
          {required ? <b aria-hidden="true">*</b> : null}
        </span>
      ) : null}

      <button
        aria-controls={dropdown.isOpen ? dropdown.listboxId : undefined}
        aria-expanded={dropdown.isOpen}
        aria-haspopup="listbox"
        className="select-dropdown-trigger"
        data-select-dropdown-trigger-id={dropdown.triggerId}
        disabled={disabled}
        onClick={dropdown.toggleMenu}
        onBlur={dropdown.closeOnFocusLeave}
        onFocus={onFocus}
        onKeyDown={dropdown.handleTriggerKeyDown}
        ref={dropdown.triggerRef}
        type="button"
      >
        <span className={dropdown.selectedOption ? undefined : "select-placeholder"}>
          {dropdown.selectedOption?.label ?? placeholder}
        </span>
        <ChevronDown aria-hidden="true" size={18} />
      </button>

      <SelectDropdownMenu
        activeIndex={dropdown.activeIndex}
        closeOnFocusLeave={dropdown.closeOnFocusLeave}
        disabled={disabled}
        handleOptionFocus={dropdown.handleOptionFocus}
        handleOptionKeyDown={dropdown.handleOptionKeyDown}
        isOpen={dropdown.isOpen}
        listboxId={dropdown.listboxId}
        menuRef={dropdown.menuRef}
        menuStyle={dropdown.menuStyle}
        onOptionClick={dropdown.onOptionClick}
        optionRefs={dropdown.optionRefs}
        options={options}
        ownerModalId={dropdown.ownerModalId}
        triggerId={dropdown.triggerId}
        value={value}
      />

      {error ? <small className="field-error">{error}</small> : null}
    </label>
  );
}
