import { useEffect } from "react";
import type { MutableRefObject } from "react";
import { getDragOver } from "./template-drag-hit-testing";
import {
  calculateReorderTargetIndex,
  findModuleDomIndex,
  findQuestionDomIndex,
} from "./template-drag-indexes";
import type {
  DragItem,
  DragOver,
  PendingDrag,
  PointerPosition,
  UseTemplateDragAndDropParams,
} from "./template-drag-and-drop.types";

const DRAG_START_THRESHOLD_PX = 5;

type UseTemplateDragEventsParams = Pick<
  UseTemplateDragAndDropParams,
  | "onDropCatalogModule"
  | "onRemoveModule"
  | "onRemoveQuestion"
  | "onReorderModules"
  | "onReorderQuestions"
> & {
  clearDrag: () => void;
  dragItemRef: MutableRefObject<DragItem | null>;
  dragOverRef: MutableRefObject<DragOver>;
  pendingDragRef: MutableRefObject<PendingDrag | null>;
  pointerRef: MutableRefObject<PointerPosition>;
  requestOverlayFrame: () => void;
  setDragOver: (dragOver: DragOver) => void;
  startDrag: (pendingDrag: PendingDrag) => void;
};

export function useTemplateDragEvents({
  clearDrag,
  dragItemRef,
  dragOverRef,
  onDropCatalogModule,
  onReorderModules,
  onReorderQuestions,
  onRemoveModule,
  onRemoveQuestion,
  pendingDragRef,
  pointerRef,
  requestOverlayFrame,
  setDragOver,
  startDrag,
}: UseTemplateDragEventsParams) {
  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!isActivePointerEvent(event, pendingDragRef.current, dragItemRef.current)) {
        return;
      }

      const pendingDrag = pendingDragRef.current;

      if (pendingDrag && !dragItemRef.current) {
        const deltaX = event.clientX - pendingDrag.startX;
        const deltaY = event.clientY - pendingDrag.startY;
        const distance = Math.hypot(deltaX, deltaY);

        if (distance < DRAG_START_THRESHOLD_PX) {
          return;
        }

        pendingDrag.startX = event.clientX;
        pendingDrag.startY = event.clientY;
        startDrag(pendingDrag);
      }

      const item = dragItemRef.current;

      if (!item) {
        return;
      }

      pointerRef.current = { x: event.clientX, y: event.clientY };
      requestOverlayFrame();
      const nextDragOver = getDragOver(event.clientX, event.clientY, item);

      if (!isSameDragOver(dragOverRef.current, nextDragOver)) {
        dragOverRef.current = nextDragOver;
        setDragOver(nextDragOver);
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (!isActivePointerEvent(event, pendingDragRef.current, dragItemRef.current)) {
        return;
      }

      const item = dragItemRef.current;
      const over = dragOverRef.current;

      if (item && over) {
        if (item.kind === "module" && over.kind === "remove") {
          onRemoveModule(item.moduleId);
        }

        if (item.kind === "question" && over.kind === "remove") {
          onRemoveQuestion(item.questionId);
        }

        if (item.kind === "catalog-module" && over.kind === "module") {
          onDropCatalogModule(item.checklistModuleId, over.insertionIndex);
        }

        if (item.kind === "module" && over.kind === "module") {
          const sourceIndex = findModuleDomIndex(item.moduleId);
          const targetIndex = calculateReorderTargetIndex(
            sourceIndex,
            over.insertionIndex,
          );
          onReorderModules(item.moduleId, targetIndex);
        }

        if (
          item.kind === "question" &&
          over.kind === "question" &&
          over.moduleId === item.moduleId
        ) {
          const sourceIndex = findQuestionDomIndex(item.moduleId, item.questionId);
          const targetIndex = calculateReorderTargetIndex(
            sourceIndex,
            over.insertionIndex,
          );
          onReorderQuestions(item.moduleId, item.questionId, targetIndex);
        }
      }

      clearDrag();
    };

    const handlePointerCancel = (event: PointerEvent) => {
      if (!isActivePointerEvent(event, pendingDragRef.current, dragItemRef.current)) {
        return;
      }

      clearDrag();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        clearDrag();
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    clearDrag,
    dragItemRef,
    dragOverRef,
    onDropCatalogModule,
    onRemoveModule,
    onRemoveQuestion,
    onReorderModules,
    onReorderQuestions,
    pendingDragRef,
    pointerRef,
    requestOverlayFrame,
    setDragOver,
    startDrag,
  ]);
}

function isActivePointerEvent(
  event: PointerEvent,
  pendingDrag: PendingDrag | null,
  dragItem: DragItem | null,
) {
  if (!pendingDrag && !dragItem) {
    return false;
  }

  return pendingDrag?.pointerId === event.pointerId;
}

function isSameDragOver(first: DragOver, second: DragOver) {
  if (first === second) {
    return true;
  }

  if (!first || !second || first.kind !== second.kind) {
    return false;
  }

  if (first.kind === "remove" && second.kind === "remove") {
    return true;
  }

  if (first.kind === "remove" || second.kind === "remove") {
    return false;
  }

  if (first.insertionIndex !== second.insertionIndex) {
    return false;
  }

  if (first.kind === "question" && second.kind === "question") {
    return first.moduleId === second.moduleId;
  }

  return true;
}
