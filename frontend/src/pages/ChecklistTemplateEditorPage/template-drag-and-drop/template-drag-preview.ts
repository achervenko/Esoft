import type { MutableRefObject } from "react";
import type { TemplateDragPreview } from "../template-structure.types";
import type { DragItem, PointerPosition } from "./template-drag-and-drop.types";

export function createDragPreview(
  item: DragItem,
  rect: DOMRect | undefined,
): TemplateDragPreview {
  const width = clamp(rect?.width ?? 280, 220, window.innerWidth - 16);
  const height =
    item.kind === "module" || item.kind === "catalog-module"
      ? 72
      : rect?.height ?? 64;

  if (item.kind === "module" || item.kind === "catalog-module") {
    return {
      height,
      kind: "module",
      name: item.name ?? "Модуль",
      questionCount: item.questionCount ?? 0,
      requiredQuestionCount:
        item.kind === "module" ? item.requiredQuestionCount ?? 0 : 0,
      width,
    };
  }

  return {
    height,
    isRequired: item.isRequired ?? false,
    kind: "question",
    questionIndex: item.questionIndex ?? 1,
    questionText: item.questionText ?? "Вопрос",
    width,
  };
}

export function calculateDragPointerOffset(
  clientX: number,
  clientY: number,
  rect: DOMRect | undefined,
): PointerPosition {
  return rect
    ? {
        x: Math.min(Math.max(clientX - rect.left, 14), 42),
        y: Math.min(Math.max(clientY - rect.top, 14), 32),
      }
    : { x: 14, y: 14 };
}

export function updateDragOverlayPosition({
  offset,
  overlay,
  pointer,
  preview,
}: {
  offset: PointerPosition;
  overlay: HTMLDivElement | null;
  pointer: PointerPosition;
  preview: TemplateDragPreview | null;
}) {
  if (!overlay || !preview) {
    return;
  }

  const padding = 8;
  const maxX = Math.max(padding, window.innerWidth - preview.width - padding);
  const maxY = Math.max(padding, window.innerHeight - preview.height - padding);
  const x = clamp(pointer.x - offset.x + 14, padding, maxX);
  const y = clamp(pointer.y - offset.y + 14, padding, maxY);

  overlay.style.width = `${preview.width}px`;
  overlay.style.transform = `translate3d(${x}px, ${y}px, 0) scale(0.98)`;
}

export function requestDragOverlayFrame(
  frameRef: MutableRefObject<number | null>,
  updateOverlayPosition: () => void,
) {
  if (frameRef.current !== null) {
    return;
  }

  frameRef.current = window.requestAnimationFrame(() => {
    frameRef.current = null;
    updateOverlayPosition();
  });
}

export function cancelDragOverlayFrame(
  frameRef: MutableRefObject<number | null>,
) {
  if (frameRef.current === null) {
    return;
  }

  window.cancelAnimationFrame(frameRef.current);
  frameRef.current = null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
