import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

export type CatalogDragKind = "module" | "question";

export type CatalogDragItem = {
  id: number;
  kind: CatalogDragKind;
  title: string;
  subtitle: string;
};

export type CatalogDragPreview = CatalogDragItem & {
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
};

export type CatalogDragState = CatalogDragPreview | null;

export type CatalogDragProps = {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
};

export type UseCatalogReorderDragParams = {
  isModuleReorderDisabled: boolean;
  isQuestionReorderDisabled: boolean;
  isSavingModules: boolean;
  isSavingQuestions: boolean;
  onReorderModules: (sourceId: number, targetIndex: number) => void;
  onReorderQuestions: (sourceId: number, targetIndex: number) => void;
};

export type UseCatalogReorderDragResult = {
  dragOverIndex: number | null;
  dragState: CatalogDragState;
  getModuleDragProps: (item: CatalogDragItem) => CatalogDragProps;
  getQuestionDragProps: (item: CatalogDragItem) => CatalogDragProps;
  moduleListRef: RefObject<HTMLDivElement | null>;
  questionListRef: RefObject<HTMLDivElement | null>;
  setOverlayRef: (element: HTMLDivElement | null) => void;
};
