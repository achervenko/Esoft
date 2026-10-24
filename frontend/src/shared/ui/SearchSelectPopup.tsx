import { createPortal } from "react-dom";
import type { OptionItem } from "../api/equipment/equipment.types";
import type { SearchSelectPopupPosition } from "./useSearchSelectPopup";

export function SearchSelectPopup({
  popup,
  isListboxVisible,
  isEmptyStateVisible,
  listboxId,
  filteredOptions,
  value,
  activeOptionId,
  emptyMessage,
  onSelect,
  onActiveOptionChange,
}: {
  popup: SearchSelectPopupPosition | null;
  isListboxVisible: boolean;
  isEmptyStateVisible: boolean;
  listboxId: string;
  filteredOptions: OptionItem[];
  value: number | null;
  activeOptionId: number | undefined;
  emptyMessage?: string;
  onSelect: (option: OptionItem) => void;
  onActiveOptionChange: (index: number) => void;
}) {
  return (
    <>
      {isListboxVisible && popup
        ? createPortal(
            <div
              className="search-select-menu"
              data-placement={popup.style.bottom === "auto" ? "bottom" : "top"}
              id={listboxId}
              role="listbox"
              style={popup.style}
              data-admin-modal-owner={popup.owner}
            >
              {filteredOptions.map((option, optionIndex) => (
                <div
                  aria-selected={option.id === value}
                  className={`search-select-option${option.id === activeOptionId ? " active" : ""}`}
                  id={`${listboxId}-option-${option.id}`}
                  key={option.id}
                  onClick={() => onSelect(option)}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => onActiveOptionChange(optionIndex)}
                  role="option"
                  tabIndex={-1}
                >
                  <span>{option.name}</span>
                  {option.position ? <small>{option.position}</small> : null}
                </div>
              ))}
            </div>,
            document.body,
          )
        : null}
      {isEmptyStateVisible && popup
        ? createPortal(
            <div
              className="search-select-menu"
              data-placement={popup.style.bottom === "auto" ? "bottom" : "top"}
              role="status"
              style={popup.style}
              data-admin-modal-owner={popup.owner}
            >
              {emptyMessage}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
