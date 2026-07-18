import type {
  TemplateDragPreview,
  TemplateDragTarget,
} from "../template-structure.types";

export type DragItem = TemplateDragTarget;

export type DragOver =
  | { insertionIndex: number; kind: "module" }
  | { insertionIndex: number; kind: "question"; moduleId: number }
  | { kind: "remove" }
  | null;

export type PointerPosition = {
  x: number;
  y: number;
};

export type PendingDrag = {
  item: DragItem;
  offset: PointerPosition;
  pointerId: number;
  preview: TemplateDragPreview;
  startX: number;
  startY: number;
};

export type PointerCapture = {
  element: HTMLElement;
  pointerId: number;
};

export type UseTemplateDragAndDropParams = {
  enabled: boolean;
  onDragStart?: () => void;
  onDropCatalogModule: (checklistModuleId: number, targetIndex: number) => void;
  onReorderModules: (moduleId: number, targetIndex: number) => void;
  onReorderQuestions: (
    moduleId: number,
    questionId: number,
    targetIndex: number,
  ) => void;
  onRemoveModule: (moduleId: number) => void;
  onRemoveQuestion: (questionId: number) => void;
};
