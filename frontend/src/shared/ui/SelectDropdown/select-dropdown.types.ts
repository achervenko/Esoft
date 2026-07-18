import type {
  CSSProperties,
  FocusEvent,
  KeyboardEvent,
  ReactNode,
  RefObject,
} from "react";

export type SelectDropdownOption = {
  content?: ReactNode;
  disabled?: boolean;
  label: string;
  title?: string;
  value: string;
};

export type SelectDropdownProps = {
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

export type SelectDropdownMenuStyle = CSSProperties | null;

export type SelectDropdownNavigationDirection = 1 | -1;

export type SelectDropdownMenuProps = {
  activeIndex: number;
  closeOnFocusLeave: (event: FocusEvent<HTMLElement>) => void;
  disabled: boolean;
  handleOptionFocus: (optionIndex: number) => void;
  handleOptionKeyDown: (
    event: KeyboardEvent<HTMLButtonElement>,
    option: SelectDropdownOption,
  ) => void;
  isOpen: boolean;
  listboxId: string;
  menuRef: RefObject<HTMLDivElement | null>;
  menuStyle: SelectDropdownMenuStyle;
  onOptionClick: (option: SelectDropdownOption) => void;
  optionRefs: RefObject<Array<HTMLButtonElement | null>>;
  options: SelectDropdownOption[];
  ownerModalId: string | null;
  triggerId: string;
  value: string;
};
