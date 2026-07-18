import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { TemplateDragPreview } from "../template-structure.types";
import {
  calculateDragPointerOffset,
  cancelDragOverlayFrame,
  createDragPreview,
  requestDragOverlayFrame,
  updateDragOverlayPosition,
} from "./template-drag-preview";
import type {
  DragItem,
  DragOver,
  PendingDrag,
  PointerCapture,
  UseTemplateDragAndDropParams,
} from "./template-drag-and-drop.types";
import { useTemplateDragEvents } from "./use-template-drag-events";

export function useTemplateDragAndDrop({
  enabled,
  onDragStart,
  onDropCatalogModule,
  onReorderModules,
  onReorderQuestions,
  onRemoveModule,
  onRemoveQuestion,
}: UseTemplateDragAndDropParams) {
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [dragOver, setDragOver] = useState<DragOver>(null);
  const [dragPreview, setDragPreview] = useState<TemplateDragPreview | null>(null);
  const dragItemRef = useRef<DragItem | null>(null);
  const dragOverRef = useRef<DragOver>(null);
  const dragPreviewRef = useRef<TemplateDragPreview | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const offsetRef = useRef({ x: 14, y: 14 });
  const captureRef = useRef<PointerCapture | null>(null);
  const pendingDragRef = useRef<PendingDrag | null>(null);

  const updateOverlayPosition = useCallback(() => {
    updateDragOverlayPosition({
      offset: offsetRef.current,
      overlay: overlayRef.current,
      pointer: pointerRef.current,
      preview: dragPreviewRef.current,
    });
  }, []);

  const requestOverlayFrame = useCallback(() => {
    requestDragOverlayFrame(frameRef, updateOverlayPosition);
  }, [updateOverlayPosition]);

  const clearDrag = useCallback(() => {
    cancelDragOverlayFrame(frameRef);

    if (captureRef.current?.element.hasPointerCapture(captureRef.current.pointerId)) {
      captureRef.current.element.releasePointerCapture(captureRef.current.pointerId);
    }

    captureRef.current = null;
    pendingDragRef.current = null;
    dragItemRef.current = null;
    dragOverRef.current = null;
    dragPreviewRef.current = null;
    document.body.classList.remove("template-dragging");
    setDragItem(null);
    setDragOver(null);
    setDragPreview(null);
  }, []);

  const cancelPendingDrag = useCallback(() => {
    if (!pendingDragRef.current || dragItemRef.current) {
      return;
    }

    if (captureRef.current?.element.hasPointerCapture(captureRef.current.pointerId)) {
      captureRef.current.element.releasePointerCapture(captureRef.current.pointerId);
    }

    captureRef.current = null;
    pendingDragRef.current = null;
  }, []);

  const startDrag = useCallback(
    (pendingDrag: PendingDrag) => {
      dragItemRef.current = pendingDrag.item;
      dragOverRef.current = null;
      dragPreviewRef.current = pendingDrag.preview;
      pointerRef.current = { x: pendingDrag.startX, y: pendingDrag.startY };
      offsetRef.current = pendingDrag.offset;
      setDragItem(pendingDrag.item);
      setDragOver(null);
      setDragPreview(pendingDrag.preview);
      document.body.classList.add("template-dragging");
      onDragStart?.();
      requestOverlayFrame();
    },
    [onDragStart, requestOverlayFrame],
  );

  const prepareDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>, item: DragItem) => {
      if (!enabled || event.button !== 0) {
        return;
      }

      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      captureRef.current = {
        element: event.currentTarget,
        pointerId: event.pointerId,
      };

      const sourceElement = event.currentTarget.closest<HTMLElement>(
        item.kind === "catalog-module"
          ? "[data-checklist-catalog-module-id]"
          : item.kind === "module"
          ? "[data-template-module-id]"
          : "[data-template-question-id]",
      );
      const rect = sourceElement?.getBoundingClientRect();
      const preview = createDragPreview(item, rect);

      pointerRef.current = { x: event.clientX, y: event.clientY };
      pendingDragRef.current = {
        item,
        offset: calculateDragPointerOffset(event.clientX, event.clientY, rect),
        pointerId: event.pointerId,
        preview,
        startX: event.clientX,
        startY: event.clientY,
      };
    },
    [enabled],
  );

  const getDragProps = useCallback(
    (item: DragItem) => ({
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) =>
        prepareDrag(event, item),
    }),
    [prepareDrag],
  );

  const setOverlayRef = useCallback(
    (element: HTMLDivElement | null) => {
      overlayRef.current = element;

      if (element && dragPreviewRef.current) {
        updateOverlayPosition();
      }
    },
    [updateOverlayPosition],
  );

  useTemplateDragEvents({
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
  });

  useEffect(() => () => clearDrag(), [clearDrag]);

  return {
    cancelDrag: clearDrag,
    cancelPendingDrag,
    dragItem,
    dragOver,
    dragPreview,
    getDragProps,
    setOverlayRef,
  };
}
