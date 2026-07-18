import { GripVertical } from "lucide-react";
import type {
  HTMLAttributes,
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import type { ChecklistTemplateModule } from "../../shared/api/checklists";
import { Checkbox } from "../../shared/ui/Checkbox";
import type {
  TemplateDragTarget,
  TemplateStructureTarget,
} from "./template-structure.types";

type TemplateModuleSectionProps = {
  dragItem: TemplateDragTarget | null;
  dragProps: (target: TemplateDragTarget) => HTMLAttributes<HTMLElement>;
  dropPosition: "after" | "before" | null;
  getContextTargetProps: (
    target: TemplateStructureTarget,
  ) => HTMLAttributes<HTMLElement>;
  isReadOnly: boolean;
  isSaving: boolean;
  module: ChecklistTemplateModule;
  moduleIndex: number;
  onFocusTarget: (target: TemplateStructureTarget) => void;
  onKeyDownTarget: (
    event: KeyboardEvent<HTMLElement>,
    target: TemplateStructureTarget,
  ) => void;
  onToggleRequired: (questionId: number, isRequired: boolean) => void;
  questionDropPosition: (
    questionId: number,
  ) => "after" | "before" | null;
};

export function TemplateModuleSection({
  dragItem,
  dragProps,
  dropPosition,
  getContextTargetProps,
  isReadOnly,
  isSaving,
  module,
  moduleIndex,
  onFocusTarget,
  onKeyDownTarget,
  onToggleRequired,
  questionDropPosition,
}: TemplateModuleSectionProps) {
  const moduleTarget: TemplateStructureTarget = {
    kind: "module",
    moduleId: module.id,
    name: module.name,
    questionCount: module.questions.length,
    requiredQuestionCount: module.questions.filter((question) => question.isRequired)
      .length,
  };
  const isDraggingModule =
    dragItem?.kind === "module" && dragItem.moduleId === module.id;
  const moduleContextProps = getContextTargetProps(moduleTarget);
  const moduleDragProps = dragProps(moduleTarget);

  return (
    <section
      className={`checklist-editor-template-module${isDraggingModule ? " dragging template-drag-source" : ""}${dropPosition ? ` drop-${dropPosition}` : ""}`}
      data-template-module-id={module.id}
      data-template-module-index={moduleIndex}
      onFocus={(event) => {
        if (event.currentTarget === event.target) {
          onFocusTarget(moduleTarget);
        }
      }}
      onKeyDown={(event) => onKeyDownTarget(event, moduleTarget)}
      onPointerCancel={moduleContextProps.onPointerCancel}
      onPointerDown={(event) => {
        moduleContextProps.onPointerDown?.(event);

        if (isReadOnly || isSaving || shouldIgnoreModuleCardDrag(event)) {
          return;
        }

        moduleDragProps.onPointerDown?.(event);
      }}
      onPointerMove={moduleContextProps.onPointerMove}
      onPointerUp={moduleContextProps.onPointerUp}
      tabIndex={isReadOnly ? undefined : 0}
      onContextMenu={moduleContextProps.onContextMenu}
    >
      <header className="checklist-editor-module-header">
        {!isReadOnly ? (
          <span
            aria-hidden="true"
            className="checklist-editor-drag-handle"
          >
            <GripVertical size={18} />
          </span>
        ) : null}
        <strong>{module.name}</strong>
      </header>

      <div className="checklist-editor-questions">
        {module.questions.map((question, questionIndex) => {
          const questionTarget: TemplateStructureTarget = {
            isRequired: question.isRequired,
            kind: "question",
            moduleId: module.id,
            questionId: question.id,
            questionIndex: questionIndex + 1,
            questionText: question.questionText,
          };
          const isDraggingQuestion =
            dragItem?.kind === "question" && dragItem.questionId === question.id;
          const position = questionDropPosition(question.id);
          const questionDragProps = dragProps(questionTarget);
          const questionContextProps = getContextTargetProps(questionTarget);

          return (
            <div
              className={`checklist-editor-question-row${isDraggingQuestion ? " dragging template-drag-source" : ""}${position ? ` drop-${position}` : ""}`}
              data-template-question-id={question.id}
              data-template-question-index={questionIndex}
              data-template-question-module-id={module.id}
              key={question.id}
              onFocus={(event) => {
                if (event.currentTarget === event.target) {
                  onFocusTarget(questionTarget);
                }
              }}
              onContextMenu={questionContextProps.onContextMenu}
              onKeyDown={(event) => {
                if (event.currentTarget === event.target) {
                  onKeyDownTarget(event, questionTarget);
                }
              }}
              onPointerCancel={questionContextProps.onPointerCancel}
              onPointerDown={(event) => {
                questionContextProps.onPointerDown?.(event);

                if (isReadOnly || isSaving || shouldIgnoreQuestionRowDrag(event)) {
                  return;
                }

                questionDragProps.onPointerDown?.(event);
              }}
              onPointerMove={questionContextProps.onPointerMove}
              onPointerUp={questionContextProps.onPointerUp}
              tabIndex={isReadOnly ? undefined : 0}
            >
              {!isReadOnly ? (
                <span
                  aria-hidden="true"
                  className="checklist-editor-drag-handle"
                >
                  <GripVertical size={18} />
                </span>
              ) : null}
              <div className="checklist-editor-question-main">
                <span>
                  {questionIndex + 1}. {question.questionText}
                </span>
                <Checkbox
                  checked={question.isRequired}
                  disabled={isReadOnly || isSaving}
                  label="Обязательный"
                  onChange={(checked) => onToggleRequired(question.id, checked)}
                />
              </div>
            </div>
          );
        })}
      </div>

    </section>
  );
}

function shouldIgnoreModuleCardDrag(event: ReactPointerEvent<HTMLElement>) {
  const target = event.target;

  if (!(target instanceof Element)) {
    return true;
  }

  return Boolean(
    target.closest(
      [
        ".checklist-editor-question-row",
        ".app-checkbox",
        ".checklist-structure-context-menu",
        "button:not(.checklist-editor-drag-handle)",
        "a",
        "input",
        "select",
        "textarea",
        "[role='button']",
      ].join(","),
    ),
  );
}

function shouldIgnoreQuestionRowDrag(event: ReactPointerEvent<HTMLElement>) {
  const target = event.target;

  if (!(target instanceof Element)) {
    return true;
  }

  return Boolean(
    target.closest(
      [
        ".app-checkbox",
        ".checklist-structure-context-menu",
        "button:not(.checklist-editor-drag-handle)",
        "a",
        "input",
        "select",
        "textarea",
        "[role='button']",
      ].join(","),
    ),
  );
}
