import { useId, type ReactNode } from "react";
import { Plus } from "lucide-react";
type Props = {
  parentTitle: string;
  childTitle: string;
  parent: ReactNode;
  children: ReactNode;
  onCreateParent?: () => void;
  onCreateChild?: () => void;
  parentCreateDisabled?: boolean;
  childCreateDisabled?: boolean;
  parentCreateLabel?: string;
  childCreateLabel?: string;
};
export function NestedDictionarySections({
  parentTitle,
  childTitle,
  parent,
  children,
  onCreateParent,
  onCreateChild,
  parentCreateDisabled,
  childCreateDisabled,
  parentCreateLabel,
  childCreateLabel,
}: Props) {
  const parentId = useId(),
    childId = useId();
  return (
    <div className="admin-nested-sections">
      <section className="admin-nested-section" aria-labelledby={parentId}>
        <header>
          <h3 id={parentId}>{parentTitle}</h3>
          {onCreateParent && (
            <button
              type="button"
              className="admin-primary-button"
              aria-label={parentCreateLabel}
              disabled={parentCreateDisabled}
              onClick={onCreateParent}
            >
              <Plus size={18} />
              Добавить
            </button>
          )}
        </header>
        <div className="dictionary-table-surface dictionary-parent-surface">
          {parent}
        </div>
      </section>
      <section className="admin-nested-section" aria-labelledby={childId}>
        <header>
          <h3 id={childId}>{childTitle}</h3>
          {onCreateChild && (
            <button
              type="button"
              className="admin-primary-button"
              aria-label={childCreateLabel}
              disabled={childCreateDisabled}
              onClick={onCreateChild}
            >
              <Plus size={18} />
              Добавить
            </button>
          )}
        </header>
        <div className="dictionary-table-surface">{children}</div>
      </section>
    </div>
  );
}
