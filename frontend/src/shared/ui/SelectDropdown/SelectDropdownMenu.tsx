import { Check } from "lucide-react";
import { createPortal } from "react-dom";
import type { SelectDropdownMenuProps } from "./select-dropdown.types";

export function SelectDropdownMenu({
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

  return createPortal(
    <div
      className="select-dropdown-menu"
      data-admin-modal-owner={ownerModalId ?? undefined}
      data-select-dropdown-trigger-id={triggerId}
      id={listboxId}
      onBlur={closeOnFocusLeave}
      ref={menuRef}
      role="listbox"
      style={menuStyle}
    >
      {options.map((option, optionIndex) => {
        const isSelected = option.value === value;
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
            onKeyDown={(event) => handleOptionKeyDown(event, option)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onOptionClick(option)}
            ref={(element) => {
              optionRefs.current[optionIndex] = element;
            }}
            role="option"
            title={option.title}
            type="button"
          >
            <span className="select-dropdown-option-content">
              {option.content ?? option.label}
            </span>
            {isSelected ? <Check aria-hidden="true" size={17} /> : null}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}
