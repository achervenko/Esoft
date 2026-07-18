import type { DragItem, DragOver } from "./template-drag-and-drop.types";

export function getDragOver(
  clientX: number,
  clientY: number,
  item: DragItem,
): DragOver {
  const element = document.elementFromPoint(clientX, clientY);

  if (!element) {
    return null;
  }

  if (item.kind === "module" || item.kind === "question") {
    const removeDropZone = element.closest<HTMLElement>(
      "[data-template-remove-drop-zone]",
    );

    if (removeDropZone) {
      return { kind: "remove" };
    }
  }

  if (item.kind === "module" || item.kind === "catalog-module") {
    const dropZone = element.closest<HTMLElement>(
      "[data-template-structure-drop-zone]",
    );

    if (!dropZone) {
      return null;
    }

    const moduleElement = element.closest<HTMLElement>(
      "[data-template-module-id]",
    );

    if (!moduleElement) {
      return {
        insertionIndex: Number(dropZone.dataset.templateModulesCount ?? 0),
        kind: "module",
      };
    }

    const moduleIndex = Number(moduleElement.dataset.templateModuleIndex);

    if (!Number.isInteger(moduleIndex)) {
      return null;
    }

    return {
      insertionIndex: getInsertionIndex(moduleElement, clientY, moduleIndex),
      kind: "module",
    };
  }

  const questionElement = element.closest<HTMLElement>(
    "[data-template-question-id]",
  );

  if (!questionElement) {
    return null;
  }

  const moduleId = Number(questionElement.dataset.templateQuestionModuleId);

  if (moduleId !== item.moduleId) {
    return null;
  }

  const questionIndex = Number(questionElement.dataset.templateQuestionIndex);

  if (!Number.isInteger(questionIndex)) {
    return null;
  }

  return {
    insertionIndex: getInsertionIndex(questionElement, clientY, questionIndex),
    kind: "question",
    moduleId,
  };
}

function getInsertionIndex(
  element: HTMLElement,
  clientY: number,
  index: number,
) {
  const rect = element.getBoundingClientRect();
  return clientY > rect.top + rect.height / 2 ? index + 1 : index;
}
