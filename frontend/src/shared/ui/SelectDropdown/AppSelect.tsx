import {
  Children,
  isValidElement,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { ChevronDown } from "lucide-react";
import { useSelectDropdown } from "./useSelectDropdown";
import { SelectDropdownMenu } from "./SelectDropdownMenu";
import type { SelectDropdownOption } from "./select-dropdown.types";
import "./SelectDropdown.css";

function textOf(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) =>
      isValidElement<{ children?: ReactNode }>(child)
        ? textOf(child.props.children)
        : String(child),
    )
    .join("");
}

function optionsOf(
  children: ReactNode,
  disabled = false,
): SelectDropdownOption[] {
  return Children.toArray(children).flatMap((child) => {
    if (
      !isValidElement<{
        children?: ReactNode;
        value?: string | number;
        disabled?: boolean;
      }>(child)
    )
      return [];
    if (child.type === "option")
      return [
        {
          value: String(child.props.value ?? textOf(child.props.children)),
          label: textOf(child.props.children),
          disabled: disabled || child.props.disabled,
        },
      ];
    return optionsOf(child.props.children, disabled || child.props.disabled);
  });
}

/** Uses the shared dropdown menu while retaining native form values and validation. */
export function AppSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const ariaLabel = props["aria-label"];
  const nativeRef = useRef<HTMLSelectElement>(null);
  const descriptionId = useId();
  const [description, setDescription] = useState("");
  const [uncontrolledValue, setUncontrolledValue] = useState(
    String(props.defaultValue ?? optionsOf(props.children)[0]?.value ?? ""),
  );
  const options = optionsOf(props.children);
  const value = String(props.value ?? uncontrolledValue);
  const dropdown = useSelectDropdown({
    value,
    options,
    disabled: props.disabled,
    onChange: (next) => {
      const native = nativeRef.current;
      if (!native || native.matches(":disabled")) return;
      const setter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        "value",
      )?.set;
      setter?.call(native, next);
      native.dispatchEvent(new Event("change", { bubbles: true }));
    },
  });
  useLayoutEffect(() => {
    const native = nativeRef.current;
    const label = native?.labels?.[0];
    setDescription(
      ariaLabel ?? label?.querySelector("span")?.textContent ?? "",
    );
  }, [ariaLabel]);
  return (
    <span className="app-select">
      <select
        {...props}
        ref={nativeRef}
        hidden
        aria-hidden="true"
        tabIndex={-1}
        aria-label={description || props["aria-label"]}
        onFocus={() => dropdown.triggerRef.current?.focus()}
        onInvalid={(event) => {
          event.preventDefault();
          dropdown.triggerRef.current?.focus();
          props.onInvalid?.(event);
        }}
        onChange={(event) => {
          setUncontrolledValue(event.target.value);
          props.onChange?.(event);
        }}
      />
      <span id={descriptionId} className="app-select-description">
        {description}
      </span>
      <button
        type="button"
        className={`select-dropdown-trigger ${props.className ?? ""}`}
        style={props.style}
        disabled={props.disabled}
        ref={dropdown.triggerRef}
        aria-required={props.required || props["aria-required"] || undefined}
        aria-invalid={props["aria-invalid"]}
        aria-describedby={[
          description ? descriptionId : null,
          props["aria-describedby"],
        ].filter(Boolean).join(" ") || undefined}
        aria-haspopup="listbox"
        aria-expanded={dropdown.isOpen}
        aria-controls={dropdown.isOpen ? dropdown.listboxId : undefined}
        data-select-dropdown-trigger-id={dropdown.triggerId}
        onClick={dropdown.toggleMenu}
        onBlur={dropdown.closeOnFocusLeave}
        onKeyDown={dropdown.handleTriggerKeyDown}
      >
        <span>{dropdown.selectedOption?.label ?? "Выберите значение"}</span>
        <ChevronDown aria-hidden="true" size={18} />
      </button>
      <SelectDropdownMenu
        {...dropdown}
        disabled={props.disabled ?? false}
        options={options}
        value={value}
        onOptionClick={dropdown.onOptionClick}
      />
    </span>
  );
}
