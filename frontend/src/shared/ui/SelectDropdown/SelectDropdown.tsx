import { RequiredMark } from "../RequiredMark";
import { ChevronDown } from "lucide-react";
import { useId } from "react";
import { SelectSearchInput } from "./SelectSearchInput";
import { SelectDropdownMenu } from "./SelectDropdownMenu";
import { useSelectDropdown } from "./useSelectDropdown";
import type { SelectDropdownProps } from "./select-dropdown.types";
import "./SelectDropdown.css";

export function SelectDropdown({
  searchable = false,
  alwaysDown = false,
  className = "",
  menuClassName,
  "aria-label": ariaLabel,
  selectedValues,
  onSelectedValuesChange,
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
  const errorId = useId();
  const inputId = useId();
  const FieldShell = searchable ? "div" : "label";
  const FieldLabel = searchable ? "label" : "span";
  const dropdown = useSelectDropdown<HTMLInputElement | HTMLButtonElement>({
    disabled,
    multiple: selectedValues !== undefined,
    selectedValues,
    searchable,
    alwaysDown,
    onChange,
    options,
    value,
  });

  return (
    <FieldShell
      className={`form-field select-dropdown-field${error ? " has-error" : ""} ${className}`.trim()}
    >
      {label ? (
        <FieldLabel
          className="form-field-label"
          htmlFor={searchable ? inputId : undefined}
        >
          {label}
          {required ? <RequiredMark /> : null}
        </FieldLabel>
      ) : null}

      {searchable ? (
        <SelectSearchInput
          inputId={inputId}
          errorId={errorId}
          ariaLabel={ariaLabel}
          selectedValues={selectedValues}
          onSelectedValuesChange={onSelectedValuesChange}
          disabled={disabled}
          label={label}
          onFocus={onFocus}
          placeholder={placeholder}
          required={required}
          error={error}
          dropdown={dropdown}
        />
      ) : (
        <button
          aria-label={ariaLabel ?? (selectedValues ? label : undefined)}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
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
          ref={(element) => {
            dropdown.triggerRef.current = element;
          }}
          type="button"
        >
          <span
            className={
              selectedValues?.length || dropdown.selectedOption
                ? undefined
                : "select-placeholder"
            }
          >
            {selectedValues
              ? dropdown.selectedText || placeholder
              : (dropdown.selectedOption?.label ?? placeholder)}
          </span>
          <ChevronDown aria-hidden="true" size={18} />
        </button>
      )}

      <SelectDropdownMenu
        className={menuClassName}
        virtualFocus={searchable}
        emptyMessage={searchable ? "Ничего не найдено" : undefined}
        label={label}
        selectedValues={selectedValues}
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
        options={dropdown.options}
        ownerModalId={dropdown.ownerModalId}
        triggerId={dropdown.triggerId}
        value={value}
      />

      {error ? (
        <small id={errorId} className="field-error">
          {error}
        </small>
      ) : null}
    </FieldShell>
  );
}
