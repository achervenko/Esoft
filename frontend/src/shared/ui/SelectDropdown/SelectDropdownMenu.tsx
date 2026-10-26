import { memo } from "react";
import "../FormField.css";
import { Check } from "lucide-react";
import { createPortal } from "react-dom";
import type { SelectDropdownMenuProps } from "./select-dropdown.types";

export const SelectDropdownMenu = memo(function SelectDropdownMenu({
  className = "",
  virtualFocus = false,
  emptyMessage,
  label,
  selectedValues,
  activeIndex,
  closeOnFocusLeave,
  disabled,
  handleOptionFocus,
  handleOptionKeyDown,
  isOpen,
  listboxId,
  menuRef,
  menuStyle,
  onOptionClick,
  optionRefs,
  options,
  ownerModalId,
  triggerId,
  value,
}: SelectDropdownMenuProps) {
  if (!isOpen || !menuStyle) {
    return null;
  }

  const selected = selectedValues ? new Set(selectedValues) : null;
  const optionButtons = options.map((option, optionIndex) => {
    const isSelected = selected
      ? selected.has(option.value)
      : option.value === value;
    const isActive = optionIndex === activeIndex;
    const isDisabled = disabled || option.disabled;
    return (
      <button
        aria-selected={isSelected}
        className={[
          isSelected ? "selected" : "",
          isActive ? "active" : "",
          isDisabled ? "disabled" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        disabled={isDisabled}
        id={`${listboxId}-option-${option.value}`}
        key={option.value}
        onFocus={() => handleOptionFocus(optionIndex)}
        onMouseMove={
          virtualFocus ? () => handleOptionFocus(optionIndex) : undefined
        }
        onKeyDown={(event) => handleOptionKeyDown(event, option)}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onOptionClick(option)}
        ref={(element) => {
          optionRefs.current[optionIndex] = element;
        }}
        role="option"
        title={option.title}
        type="button"
        tabIndex={virtualFocus ? -1 : undefined}
      >
        <span className="select-dropdown-option-content">
          {option.content ?? option.label}
        </span>
        {isSelected ? <Check aria-hidden="true" size={17} /> : null}
      </button>
    );
  });

  return createPortal(
    <div
      className={`select-dropdown-menu ${className}`.trim()}
      data-compact={options.length <= 4 ? "true" : undefined}
      data-admin-modal-owner={ownerModalId ?? undefined}
      data-select-dropdown-trigger-id={triggerId}
      id={listboxId}
      onBlur={closeOnFocusLeave}
      ref={menuRef}
      role="listbox"
      aria-label={label}
      aria-multiselectable={selectedValues ? true : undefined}
      style={menuStyle}
    >
      {optionButtons}
      {options.length === 0 && emptyMessage ? (
        <p className="select-dropdown-empty" role="status">
          {emptyMessage}
        </p>
      ) : null}
    </div>,
    document.body,
  );
});
