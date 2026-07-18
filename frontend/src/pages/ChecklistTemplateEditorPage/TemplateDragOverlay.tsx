import { GripVertical } from "lucide-react";
import { formatQuestionCount } from "../../shared/lib/formatters";
import type { TemplateDragPreview } from "./template-structure.types";

type TemplateDragOverlayProps = {
  preview: TemplateDragPreview | null;
  setOverlayRef: (element: HTMLDivElement | null) => void;
};

export function TemplateDragOverlay({
  preview,
  setOverlayRef,
}: TemplateDragOverlayProps) {
  if (!preview) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className={`template-drag-overlay ${preview.kind}`}
      ref={setOverlayRef}
    >
      <GripVertical size={18} />
      {preview.kind === "module" ? (
        <div className="template-drag-overlay-content">
          <strong>{preview.name}</strong>
          <small>
            {formatQuestionCount(preview.questionCount)}
            {preview.requiredQuestionCount > 0
              ? ` · обязательных: ${preview.requiredQuestionCount}`
              : ""}
          </small>
        </div>
      ) : (
        <div className="template-drag-overlay-content">
          <span>
            {preview.questionIndex}. {preview.questionText}
          </span>
          {preview.isRequired ? <small>Обязательный</small> : null}
        </div>
      )}
    </div>
  );
}

