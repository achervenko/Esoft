import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { ChecklistTemplateDetail } from "../../shared/api/checklists";
import type { TemplateStructureTarget } from "./template-structure.types";
import type { useChecklistTemplateEditor } from "./useChecklistTemplateEditor";
import { useTemplateContextMenu } from "./useTemplateContextMenu";
import { useTemplateDragAndDrop } from "./useTemplateDragAndDrop";

type EditorState = ReturnType<typeof useChecklistTemplateEditor>;

type UseTemplateStructureInteractionsParams = {
  editor: EditorState;
  isReadOnly: boolean;
  onDropCatalogModule: (moduleId: number, targetIndex?: number) => void;
  onOpenAddQuestions: (moduleId: number) => void;
  resetKey: string;
  template: ChecklistTemplateDetail | null;
};

export function useTemplateStructureInteractions({
  editor,
  isReadOnly,
  onDropCatalogModule,
  onOpenAddQuestions,
  resetKey,
  template,
}: UseTemplateStructureInteractionsParams) {
  const [focusedTarget, setFocusedTarget] =
    useState<TemplateStructureTarget | null>(null);
  const cancelDragRef = useRef<() => void>(() => {});

  const requestStructureDelete = useCallback(
    (target: TemplateStructureTarget) => {
      if (!template || isReadOnly || editor.isSaving) {
        return;
      }

      if (target.kind === "question") {
        setFocusedTarget(null);
        void editor.removeQuestion(target.questionId);
        return;
      }

      setFocusedTarget(null);
      void editor.removeModule(target.moduleId);
    },
    [editor, isReadOnly, template],
  );

  const contextMenu = useTemplateContextMenu({
    enabled: !isReadOnly && !editor.isSaving,
    onOpenMenu: () => cancelDragRef.current(),
    onRequestDelete: requestStructureDelete,
  });

  const dragAndDrop = useTemplateDragAndDrop({
    enabled: !isReadOnly && !editor.isSaving,
    onDragStart: contextMenu.closeMenu,
    onDropCatalogModule,
    onReorderModules: (moduleId, targetIndex) => {
      void editor.reorderModules(moduleId, targetIndex);
    },
    onReorderQuestions: (moduleId, questionId, targetIndex) => {
      void editor.reorderQuestions(moduleId, questionId, targetIndex);
    },
    onRemoveModule: (moduleId) => {
      requestStructureDelete({ kind: "module", moduleId });
    },
    onRemoveQuestion: (questionId) => {
      const target = getQuestionTarget(template, questionId);

      if (target) {
        requestStructureDelete(target);
      }
    },
  });
  cancelDragRef.current = dragAndDrop.cancelDrag;
  const { closeMenu } = contextMenu;
  const { cancelDrag } = dragAndDrop;

  useEffect(() => {
    setFocusedTarget(null);
    closeMenu();
    cancelDrag();
  }, [cancelDrag, closeMenu, resetKey]);

  const handleTargetKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>, target: TemplateStructureTarget) => {
      if (
        isReadOnly ||
        editor.isSaving ||
        event.currentTarget !== event.target
      ) {
        return;
      }

      if (event.key === "Delete") {
        event.preventDefault();
        event.stopPropagation();
        requestStructureDelete(target);
        return;
      }

      if (event.shiftKey && event.key === "F10") {
        event.preventDefault();
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        contextMenu.openMenu(target, rect.left + 12, rect.top + 12);
      }
    },
    [contextMenu, editor.isSaving, isReadOnly, requestStructureDelete],
  );

  const handleContextAddQuestions = useCallback(() => {
    const target = contextMenu.menu?.target;

    if (target?.kind !== "module") {
      return;
    }

    contextMenu.closeMenu();
    onOpenAddQuestions(target.moduleId);
  }, [contextMenu, onOpenAddQuestions]);

  return {
    contextMenu,
    dragAndDrop,
    focusedTarget,
    handleContextAddQuestions,
    handleTargetKeyDown,
    setFocusedTarget,
  };
}

function getQuestionTarget(
  template: ChecklistTemplateDetail | null,
  questionId: number,
): TemplateStructureTarget | null {
  if (!template) {
    return null;
  }

  for (const module of template.modules) {
    if (module.questions.some((question) => question.id === questionId)) {
      return {
        kind: "question",
        moduleId: module.id,
        questionId,
      };
    }
  }

  return null;
}
