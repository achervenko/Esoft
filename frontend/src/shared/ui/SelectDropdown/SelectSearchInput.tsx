import { ChevronDown } from "lucide-react";
import { useRef, useLayoutEffect } from "react";
import { useSelectDropdown } from "./useSelectDropdown";
import type { SelectDropdownProps } from "./select-dropdown.types";

type Props = Pick<
  SelectDropdownProps,
  | "selectedValues"
  | "onSelectedValuesChange"
  | "disabled"
  | "label"
  | "onFocus"
  | "placeholder"
  | "required"
  | "error"
> & {
  inputId: string;
  errorId: string;
  ariaLabel?: string;
  dropdown: ReturnType<
    typeof useSelectDropdown<HTMLInputElement | HTMLButtonElement>
  >;
};
export function SelectSearchInput({
  inputId,
  errorId,
  ariaLabel,
  selectedValues,
  onSelectedValuesChange,
  disabled,
  label,
  onFocus,
  placeholder,
  required,
  error,
  dropdown,
}: Props) {
  const firstPointerFocus = useRef(false);
  const pendingCaret = useRef<number | null>(null);
  const activeOption = dropdown.options[dropdown.activeIndex];
  const selectedText = dropdown.selectedText;
  useLayoutEffect(() => {
    const input = dropdown.triggerRef.current;
    if (pendingCaret.current !== null && input instanceof HTMLInputElement) {
      input.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  });
  return (
    <span className="select-field-input-shell">
      <input
        id={inputId}
        aria-label={ariaLabel ?? label}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        aria-controls={dropdown.isOpen ? dropdown.listboxId : undefined}
        aria-expanded={dropdown.isOpen}
        aria-autocomplete="list"
        aria-activedescendant={
          dropdown.isOpen && activeOption && !activeOption.disabled
            ? `${dropdown.listboxId}-option-${activeOption.value}`
            : undefined
        }
        autoComplete="off"
        className="select-dropdown-trigger select-field-input"
        data-select-dropdown-trigger-id={dropdown.triggerId}
        disabled={disabled}
        onPointerDownCapture={(event) => {
          firstPointerFocus.current =
            document.activeElement !== event.currentTarget;
          if (
            firstPointerFocus.current &&
            event.button === 0 &&
            event.pointerType === "mouse"
          ) {
            event.preventDefault();
            event.currentTarget.focus({ preventScroll: true });
            const end = event.currentTarget.value.length;
            event.currentTarget.setSelectionRange(end, end);
          }
        }}
        onBlur={dropdown.closeOnFocusLeave}
        onChange={(event) => {
          const input = event.target;
          const result = dropdown.setQuery(
            input.value,
            input.selectionStart ?? input.value.length,
            (event.nativeEvent as InputEvent).data,
          );
          if (
            selectedValues &&
            result.values &&
            result.values.length !== selectedValues.length
          )
            onSelectedValuesChange?.(result.values);
          if (result.text !== input.value) pendingCaret.current = result.caret;
        }}
        onPaste={(event) => {
          if (!selectedValues && !dropdown.isTyping && selectedText) {
            const text = event.clipboardData.getData("text");
            if (text) {
              event.preventDefault();
              dropdown.setQuery(text);
            }
          }
        }}
        onSelect={(event) => {
          if (dropdown.isTyping)
            dropdown.setQueryCaret(
              event.currentTarget.selectionStart ??
                event.currentTarget.value.length,
            );
        }}
        onClick={(event) => {
          if (firstPointerFocus.current) {
            const end = event.currentTarget.value.length;
            event.currentTarget.setSelectionRange(end, end);
            firstPointerFocus.current = false;
          }
          if (!dropdown.isOpen) dropdown.openMenu();
        }}
        onFocus={(event) => {
          onFocus?.();
          dropdown.openMenu();
          const end = event.currentTarget.value.length;
          event.currentTarget.setSelectionRange(end, end);
        }}
        onKeyDown={dropdown.handleSearchKeyDown}
        placeholder={placeholder}
        ref={(element) => {
          dropdown.triggerRef.current = element;
        }}
        role="combobox"
        type="text"
        value={dropdown.isTyping ? dropdown.query : selectedText}
      />
      <button
        type="button"
        className="select-field-toggle"
        tabIndex={-1}
        disabled={disabled}
        aria-label={`${dropdown.isOpen ? "Скрыть" : "Показать"} варианты: ${label ?? "значение"}`}
        aria-expanded={dropdown.isOpen}
        aria-haspopup="listbox"
        aria-controls={dropdown.isOpen ? dropdown.listboxId : undefined}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          if (dropdown.isOpen) {
            dropdown.toggleMenu();
          } else {
            dropdown.triggerRef.current?.focus({ preventScroll: true });
            dropdown.openMenu();
          }
        }}
      >
        <ChevronDown aria-hidden="true" size={18} />
      </button>
    </span>
  );
}
