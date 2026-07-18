import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  getCatalogTargetIndex,
  isInteractiveTarget,
} from "./catalog-reorder.helpers";
import type {
  CatalogDragItem,
  CatalogDragState,
  UseCatalogReorderDragParams,
  UseCatalogReorderDragResult,
} from "./catalog-reorder.types";

const DRAG_THRESHOLD = 5;

export function useCatalogReorderDrag({
  isModuleReorderDisabled,
  isQuestionReorderDisabled,
  isSavingModules,
  isSavingQuestions,
  onReorderModules,
  onReorderQuestions,
}: UseCatalogReorderDragParams): UseCatalogReorderDragResult {
  const moduleListRef = useRef<HTMLDivElement | null>(null);
  const questionListRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const previewFrameRef = useRef<number | null>(null);
  const previewPositionRef = useRef({ x: 0, y: 0 });
  const pendingDragRef = useRef<CatalogDragState>(null);
  const pointerCaptureRef = useRef<{
    element: HTMLElement;
    pointerId: number;
  } | null>(null);
  const [dragState, setDragState] = useState<CatalogDragState>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragStateRef = useRef<CatalogDragState>(null);
  const dragOverIndexRef = useRef<number | null>(null);
  const onReorderModulesRef = useRef(onReorderModules);
  const onReorderQuestionsRef = useRef(onReorderQuestions);

  const clearDrag = useCallback(() => {
    if (previewFrameRef.current !== null) {
      window.cancelAnimationFrame(previewFrameRef.current);
      previewFrameRef.current = null;
    }

    const pointerCapture = pointerCaptureRef.current;

    if (pointerCapture) {
      const { element, pointerId } = pointerCapture;

      if (element.hasPointerCapture(pointerId)) {
        element.releasePointerCapture(pointerId);
      }
    }

    pointerCaptureRef.current = null;
    pendingDragRef.current = null;
    dragStateRef.current = null;
    dragOverIndexRef.current = null;
    setDragState(null);
    setDragOverIndex(null);
    document.body.classList.remove("checklist-order-dragging");
  }, []);

  const updateDragState = useCallback((nextDragState: CatalogDragState) => {
    dragStateRef.current = nextDragState;
    setDragState(nextDragState);
  }, []);

  const updateDragOverIndex = useCallback((nextDragOverIndex: number | null) => {
    if (dragOverIndexRef.current === nextDragOverIndex) {
      return;
    }

    dragOverIndexRef.current = nextDragOverIndex;
    setDragOverIndex(nextDragOverIndex);
  }, []);

  const scheduleOverlayPosition = useCallback((x: number, y: number) => {
    previewPositionRef.current = { x, y };

    if (previewFrameRef.current !== null) {
      return;
    }

    previewFrameRef.current = window.requestAnimationFrame(() => {
      previewFrameRef.current = null;
      const overlay = overlayRef.current;

      if (!overlay) {
        return;
      }

      const position = previewPositionRef.current;
      overlay.style.transform = `translate3d(${position.x + 12}px, ${position.y + 12}px, 0)`;
    });
  }, []);

  const startDrag = useCallback(
    (
      event: ReactPointerEvent<HTMLElement>,
      item: CatalogDragItem,
    ) => {
      if (
        event.button !== 0 ||
        isInteractiveTarget(event.target, event.currentTarget) ||
        (item.kind === "module" &&
          (isSavingModules || isModuleReorderDisabled)) ||
        (item.kind === "question" &&
          (isSavingQuestions || isQuestionReorderDisabled))
      ) {
        return;
      }

      pendingDragRef.current = {
        ...item,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        x: event.clientX,
        y: event.clientY,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      pointerCaptureRef.current = {
        element: event.currentTarget,
        pointerId: event.pointerId,
      };
    },
    [
      isModuleReorderDisabled,
      isQuestionReorderDisabled,
      isSavingModules,
      isSavingQuestions,
    ],
  );

  useEffect(() => {
    onReorderModulesRef.current = onReorderModules;
  }, [onReorderModules]);

  useEffect(() => {
    onReorderQuestionsRef.current = onReorderQuestions;
  }, [onReorderQuestions]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const pending = pendingDragRef.current;

      if (!pending || pending.pointerId !== event.pointerId) {
        return;
      }

      const delta = Math.max(
        Math.abs(event.clientX - pending.startX),
        Math.abs(event.clientY - pending.startY),
      );

      if (!dragStateRef.current && delta < DRAG_THRESHOLD) {
        return;
      }

      event.preventDefault();
      document.body.classList.add("checklist-order-dragging");
      if (!dragStateRef.current) {
        updateDragState({ ...pending, x: event.clientX, y: event.clientY });
      }
      scheduleOverlayPosition(event.clientX, event.clientY);
      updateDragOverIndex(
        getCatalogTargetIndex(
          pending.kind,
          event.clientY,
          moduleListRef.current,
          questionListRef.current,
        ),
      );
    };

    const handlePointerUp = (event: PointerEvent) => {
      const pending = pendingDragRef.current;

      if (!pending || pending.pointerId !== event.pointerId) {
        return;
      }

      const currentDragState = dragStateRef.current;
      const currentDragOverIndex = dragOverIndexRef.current;

      if (currentDragState && currentDragOverIndex !== null) {
        if (pending.kind === "module") {
          onReorderModulesRef.current(pending.id, currentDragOverIndex);
        } else {
          onReorderQuestionsRef.current(pending.id, currentDragOverIndex);
        }
      }

      clearDrag();
    };

    const handlePointerCancel = (event: PointerEvent) => {
      const pending = pendingDragRef.current;

      if (pending?.pointerId === event.pointerId) {
        clearDrag();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        clearDrag();
      }
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointercancel", handlePointerCancel);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("pointercancel", handlePointerCancel);
      document.removeEventListener("keydown", handleKeyDown);
      clearDrag();
    };
  }, [
    clearDrag,
    scheduleOverlayPosition,
    updateDragOverIndex,
    updateDragState,
  ]);

  const setOverlayRef = useCallback((element: HTMLDivElement | null) => {
    overlayRef.current = element;
  }, []);

  const getModuleDragProps = useCallback(
    (item: CatalogDragItem) => ({
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) =>
        startDrag(event, item),
    }),
    [startDrag],
  );

  const getQuestionDragProps = useCallback(
    (item: CatalogDragItem) => ({
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) =>
        startDrag(event, item),
    }),
    [startDrag],
  );

  return {
    dragOverIndex,
    dragState,
    getModuleDragProps,
    getQuestionDragProps,
    moduleListRef,
    questionListRef,
    setOverlayRef,
  };
}
