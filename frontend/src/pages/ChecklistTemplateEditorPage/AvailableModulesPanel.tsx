import { GripVertical, Trash2 } from "lucide-react";
import type {
  HTMLAttributes,
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import type {
  ChecklistModule,
  ChecklistQuestion,
  ChecklistTemplateDetail,
} from "../../shared/api/checklists";
import { formatQuestionCount } from "../../shared/lib/formatters";
import type {
  TemplateCatalogModuleTarget,
  TemplateDragTarget,
} from "./template-structure.types";
import type { useTemplateDragAndDrop } from "./useTemplateDragAndDrop";

type AvailableModulesPanelProps = {
  dragItem: TemplateDragTarget | null;
  dragOver: ReturnType<typeof useTemplateDragAndDrop>["dragOver"];
  dragProps: (target: TemplateDragTarget) => HTMLAttributes<HTMLElement>;
  isReadOnly: boolean;
  isSaving: boolean;
  modules: ChecklistModule[];
  onAddModule: (moduleId: number, targetIndex?: number) => void;
  questions: ChecklistQuestion[];
  template: ChecklistTemplateDetail;
};

export function AvailableModulesPanel({
  dragItem,
  dragOver,
  dragProps,
  isReadOnly,
  isSaving,
  modules,
  onAddModule,
  questions,
  template,
}: AvailableModulesPanelProps) {
  const questionCountByModuleId = questions.reduce<Map<number, number>>(
    (counts, question) => {
      if (question.checklistModuleId === null) {
        return counts;
      }

      counts.set(
        question.checklistModuleId,
        (counts.get(question.checklistModuleId) ?? 0) + 1,
      );
      return counts;
    },
    new Map(),
  );
  const availableModules = modules
    .map((module) => ({
      module,
      questionsCount: questionCountByModuleId.get(module.id) ?? 0,
    }))
    .filter(
      ({ module }) =>
        !template.modules.some(
          (templateModule) => templateModule.checklistModuleId === module.id,
        ),
    );
  const isRemoveDropActive =
    dragItem?.kind === "module" || dragItem?.kind === "question";
  const isRemoveDropOver = isRemoveDropActive && dragOver?.kind === "remove";

  const handleKeyboardAdd = (
    event: KeyboardEvent<HTMLDivElement>,
    moduleId: number,
  ) => {
    if (
      isReadOnly ||
      isSaving ||
      event.defaultPrevented ||
      event.currentTarget !== event.target
    ) {
      return;
    }

    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    onAddModule(moduleId, template.modules.length);
  };

  return (
    <aside
      className={`checklist-editor-panel checklist-editor-available-panel${isRemoveDropActive ? " remove-drop-active" : ""}${isRemoveDropOver ? " remove-drop-over" : ""}`}
      data-template-remove-drop-zone={isRemoveDropActive ? "true" : undefined}
    >
      {isRemoveDropActive ? (
        <div aria-hidden="true" className="checklist-editor-remove-drop-zone">
          <Trash2 aria-hidden="true" size={42} />
        </div>
      ) : (
        <>
          <h2>Доступные модули</h2>
          <div className="checklist-editor-available-list">
            {availableModules.length === 0 ? (
              <p className="admin-state">Все доступные модули уже добавлены.</p>
            ) : null}
            {availableModules.map(({ module, questionsCount }) => {
              const dragTarget: TemplateCatalogModuleTarget = {
                checklistModuleId: module.id,
                kind: "catalog-module",
                name: module.name,
                questionCount: questionsCount,
              };
              const isDragging =
                dragItem?.kind === "catalog-module" &&
                dragItem.checklistModuleId === module.id;
              const dragAttributes = dragProps(dragTarget);

              return (
                <div
                  className={`checklist-editor-available-module${isDragging ? " dragging template-drag-source" : ""}`}
                  data-checklist-catalog-module-id={module.id}
                  key={module.id}
                  onKeyDown={(event) => handleKeyboardAdd(event, module.id)}
                  onPointerDown={(event) => {
                    if (
                      isReadOnly ||
                      isSaving ||
                      shouldIgnoreCatalogModuleDrag(event)
                    ) {
                      return;
                    }

                    dragAttributes.onPointerDown?.(event);
                  }}
                  role={isReadOnly || isSaving ? undefined : "button"}
                  tabIndex={isReadOnly || isSaving ? undefined : 0}
                >
                  {!isReadOnly ? (
                    <span
                      aria-hidden="true"
                      className="checklist-editor-drag-handle"
                    >
                      <GripVertical size={18} />
                    </span>
                  ) : null}
                  <div className="checklist-editor-available-module-content">
                    <strong>{module.name}</strong>
                    <small>{formatQuestionCount(questionsCount)}</small>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </aside>
  );
}

function shouldIgnoreCatalogModuleDrag(event: ReactPointerEvent<HTMLElement>) {
  const target = event.target;

  if (!(target instanceof Element)) {
    return true;
  }

  const interactiveElement = target.closest(
    ["a", "input", "select", "textarea", "[role='button']"].join(","),
  );

  return Boolean(
    interactiveElement && interactiveElement !== event.currentTarget,
  );
}
