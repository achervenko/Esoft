import { Check, ChevronDown } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import "./SelectDropdown.css";

export type SelectDropdownOption = {
  content?: ReactNode;
  label: string;
  title?: string;
  value: string;
};

type SelectDropdownProps = {
  disabled?: boolean;
  error?: string;
  label?: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  options: SelectDropdownOption[];
  placeholder?: string;
  required?: boolean;
  value: string;
};

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
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const listboxId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );
  const selectedIndex = useMemo(
    () => options.findIndex((option) => option.value === value),
    [options, value],
  );

  const selectOption = (option: SelectDropdownOption) => {
    onChange(option.value);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const openMenu = (nextActiveIndex = selectedIndex >= 0 ? selectedIndex : 0) => {
    if (disabled || options.length === 0) {
      return;
    }

    onFocus?.();
    updateMenuPosition();
    setActiveIndex(clampIndex(nextActiveIndex, options.length));
    setIsOpen(true);
  };

  const toggleMenu = () => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }

    openMenu();
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

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const activeOption = optionRefs.current[activeIndex];

    activeOption?.focus();
    activeOption?.scrollIntoView({ block: "nearest" });

    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (
        target instanceof Node &&
        (triggerRef.current?.contains(target) || menuRef.current?.contains(target))
      ) {
        return;
      }

      setIsOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsidePointerDown);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
    };
  }, [activeIndex, isOpen]);

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      openMenu(selectedIndex >= 0 ? selectedIndex : 0);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      openMenu(selectedIndex >= 0 ? selectedIndex : options.length - 1);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleMenu();
      return;
    }

    if (event.key === "Escape") {
      setIsOpen(false);
    }
  };

  const handleOptionKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    option: SelectDropdownOption,
  ) => {
    if (event.key === "Tab") {
      setIsOpen(false);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((currentIndex) =>
        clampIndex(currentIndex + 1, options.length),
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((currentIndex) =>
        clampIndex(currentIndex - 1, options.length),
      );
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(Math.max(options.length - 1, 0));
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectOption(option);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    }
  };

  const closeOnFocusLeave = (event: FocusEvent<HTMLElement>) => {
    const nextFocusedElement = event.relatedTarget;

    if (
      nextFocusedElement instanceof Node &&
      (triggerRef.current?.contains(nextFocusedElement) ||
        menuRef.current?.contains(nextFocusedElement))
    ) {
      return;
    }

    setIsOpen(false);
  };

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
        aria-controls={isOpen ? listboxId : undefined}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="select-dropdown-trigger"
        disabled={disabled}
        onClick={toggleMenu}
        onBlur={closeOnFocusLeave}
        onFocus={onFocus}
        onKeyDown={handleTriggerKeyDown}
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
            <div
              className="select-dropdown-menu"
              id={listboxId}
              onBlur={closeOnFocusLeave}
              ref={menuRef}
              role="listbox"
              style={menuStyle}
            >
              {options.map((option, optionIndex) => {
                const isSelected = option.value === value;
                const isActive = optionIndex === activeIndex;

                return (
                  <button
                    aria-selected={isSelected}
                    className={[
                      isSelected ? "selected" : "",
                      isActive ? "active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    disabled={disabled}
                    id={`${listboxId}-option-${option.value}`}
                    key={option.value}
                    onFocus={() => setActiveIndex(optionIndex)}
                    onKeyDown={(event) => handleOptionKeyDown(event, option)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectOption(option)}
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
          )
        : null}
      {error ? <small className="field-error">{error}</small> : null}
    </label>
  );
}

function clampIndex(index: number, length: number) {
  if (length <= 0) {
    return 0;
  }

  if (index < 0) {
    return length - 1;
  }

  if (index >= length) {
    return 0;
  }

  return index;
}
