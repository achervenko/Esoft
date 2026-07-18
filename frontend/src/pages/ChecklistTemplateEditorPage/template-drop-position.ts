import type { useTemplateDragAndDrop } from "./useTemplateDragAndDrop";

type DragOverState = ReturnType<typeof useTemplateDragAndDrop>["dragOver"];
type DragItemState = ReturnType<typeof useTemplateDragAndDrop>["dragItem"];

export function isCatalogModuleDragOver(
  dragItem: DragItemState,
  dragOver: DragOverState,
) {
  return dragItem?.kind === "catalog-module" && dragOver?.kind === "module";
}

export function getModuleDropPosition(
  dragOver: DragOverState,
  moduleIndex: number,
): "after" | "before" | null {
  if (!dragOver || dragOver.kind !== "module") {
    return null;
  }

  if (dragOver.insertionIndex === moduleIndex) {
    return "before";
  }

  if (dragOver.insertionIndex === moduleIndex + 1) {
    return "after";
  }

  return null;
}

export function getQuestionDropPosition(
  dragOver: DragOverState,
  moduleId: number,
  questionIndex: number,
): "after" | "before" | null {
  if (
    !dragOver ||
    dragOver.kind !== "question" ||
    dragOver.moduleId !== moduleId
  ) {
    return null;
  }

  if (dragOver.insertionIndex === questionIndex) {
    return "before";
  }

  if (dragOver.insertionIndex === questionIndex + 1) {
    return "after";
  }

  return null;
}
