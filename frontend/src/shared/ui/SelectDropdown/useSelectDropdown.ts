import { useSelectTextEditor } from "./useSelectTextEditor";
import { useSelectDropdownPopup } from "./useSelectDropdownPopup";
import { DialogPopupReadyContext } from "../DialogPopupReadyContext";
import {
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { getNextEnabledIndex } from "./select-dropdown-focus";
import { useSelectDropdownFocus } from "./useSelectDropdownFocus";
import { useSelectDropdownKeyboard } from "./useSelectDropdownKeyboard";
import type {
  SelectDropdownOption,
  SelectDropdownProps,
} from "./select-dropdown.types";

export function useSelectDropdown<T extends HTMLElement = HTMLButtonElement>({
  disabled = false,
  multiple = false,
  searchable = false,
  alwaysDown = false,
  selectedValues,
  onChange,
  options: allOptions,
  value,
}: Pick<
  SelectDropdownProps,
  "disabled" | "onChange" | "options" | "value" | "selectedValues"
> & {
  multiple?: boolean;
  searchable?: boolean;
  alwaysDown?: boolean;
}) {
  const isDialogReady = useContext(DialogPopupReadyContext);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const editor = useSelectTextEditor(
    allOptions,
    multiple ? (selectedValues ?? []) : undefined,
    value,
  );
  const { reset: resetEditor } = editor;
  const keyboardChoice = useRef(false);
  const normalizedOptions = useMemo(
    () =>
      allOptions.map((option) => ({
        option,
        search: option.label.toLocaleLowerCase("ru"),
      })),
    [allOptions],
  );
  const options = useMemo(() => {
    const search = searchable ? editor.searchTerm.toLocaleLowerCase("ru") : "";
    return search
      ? normalizedOptions
          .filter((entry) => entry.search.includes(search))
          .map((entry) => entry.option)
      : allOptions;
  }, [allOptions, normalizedOptions, searchable, editor.searchTerm]);
  useEffect(() => {
    if (disabled || (!isDialogReady && !searchable)) {
      setIsOpen(false);
      resetEditor();
    }
  }, [disabled, isDialogReady, searchable, resetEditor]);
  const listboxId = useId();
  const triggerId = useId();
  const triggerRef = useRef<T | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const { menuStyle, ownerModalId } = useSelectDropdownPopup({
    triggerRef,
    isOpen,
    disabled,
    isDialogReady,
    optionCount: options.length,
    alwaysDown,
    menuRef,
  });
  const selectedOption = useMemo(
    () => allOptions.find((option) => option.value === value) ?? null,
    [allOptions, value],
  );
  const selectedIndex = useMemo(
    () => options.findIndex((option) => option.value === value),
    [options, value],
  );

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    resetEditor();
  }, [resetEditor]);

  const selectOption = useCallback(
    (option: SelectDropdownOption) => {
      if (disabled || option.disabled) {
        return;
      }

      onChange(option.value);
      keyboardChoice.current = false;
      resetEditor();
      if (!multiple) {
        closeMenu();
        if (searchable) triggerRef.current?.blur();
        else triggerRef.current?.focus();
      }
    },
    [disabled, onChange, resetEditor, multiple, searchable, closeMenu],
  );

  const openMenu = (
    nextActiveIndex = selectedIndex >= 0 ? selectedIndex : searchable ? -1 : 0,
  ) => {
    if (disabled || !isDialogReady || (!searchable && options.length === 0)) {
      return;
    }
    keyboardChoice.current = false;

    const resolvedActiveIndex =
      searchable && nextActiveIndex < 0
        ? -1
        : getNextEnabledIndex(options, nextActiveIndex);
    setActiveIndex(resolvedActiveIndex);
    setIsOpen(true);
  };

  const toggleMenu = () => {
    if (isOpen) {
      closeMenu();
      return;
    }

    openMenu();
  };

  const { closeOnFocusLeave, handleOptionTab } = useSelectDropdownFocus({
    triggerRef,
    menuRef,
    optionRefs,
    activeIndex,
    isOpen,
    isDialogReady,
    isPopupPositioned: menuStyle !== null,
    searchable,
    ownerModalId,
    closeMenu,
  });
  const {
    handleTriggerKeyDown,
    handleOptionKeyDown,
    handleSearchKeyDown,
    handleOptionFocus,
  } = useSelectDropdownKeyboard({
    disabled,
    multiple,
    isOpen,
    options,
    selectedIndex,
    activeIndex,
    setActiveIndex,
    keyboardChoice,
    triggerRef,
    openMenu,
    closeMenu,
    toggleMenu,
    selectOption,
    handleOptionTab,
  });

  return {
    options,
    query: editor.query,
    isTyping: editor.isTyping,
    selectedText: editor.selectedText,
    handleSearchKeyDown,
    setQuery: (next: string, caret = next.length, inserted?: string | null) => {
      keyboardChoice.current = false;
      const result = editor.change(next, caret, inserted);
      setIsOpen(true);
      setActiveIndex(-1);
      return result;
    },
    setQueryCaret: editor.setCaret,
    activeIndex,
    closeOnFocusLeave,
    handleOptionFocus,
    handleOptionKeyDown,
    handleTriggerKeyDown,
    isOpen: isOpen && isDialogReady,
    listboxId,
    menuRef,
    menuStyle,
    onOptionClick: selectOption,
    openMenu,
    optionRefs,
    ownerModalId,
    selectedOption,
    toggleMenu,
    triggerId,
    triggerRef,
  };
}
