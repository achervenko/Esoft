import { useCallback, useEffect, useRef, useState } from "react";
import type { TemplateEditorConfirmState } from "./checklist-template-editor.utils";

type UseChecklistTemplateEditorPageStateParams = {
  copyFromTemplateId?: number | null;
  isNewTemplate: boolean;
  isTemplateLoading: boolean;
  templateId: number | null;
  templateReady: boolean;
};

export function useChecklistTemplateEditorPageState({
  copyFromTemplateId = null,
  isNewTemplate,
  isTemplateLoading,
  templateId,
  templateReady,
}: UseChecklistTemplateEditorPageStateParams) {
  const [editMainData, setEditMainData] = useState(false);
  const [addModuleId, setAddModuleId] = useState<number | null>(null);
  const [addModuleTargetIndex, setAddModuleTargetIndex] = useState<number | null>(
    null,
  );
  const [addQuestionModuleId, setAddQuestionModuleId] = useState<number | null>(
    null,
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [mainDataError, setMainDataError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<TemplateEditorConfirmState>(null);
  const autoOpenedMainDataRef = useRef(false);

  const openMainDataModal = useCallback((error: string | null = null) => {
    setMainDataError(error);
    setEditMainData(true);
  }, []);

  const closeMainDataModal = useCallback(() => {
    setEditMainData(false);
    setMainDataError(null);
  }, []);

  const openAddModuleModal = useCallback(
    (moduleId: number, targetIndex?: number) => {
      setAddModuleId(moduleId);
      setAddModuleTargetIndex(targetIndex ?? null);
    },
    [],
  );

  const closeAddModuleModal = useCallback(() => {
    setAddModuleId(null);
    setAddModuleTargetIndex(null);
  }, []);

  const openAddQuestionModal = useCallback((moduleId: number) => {
    setAddQuestionModuleId(moduleId);
  }, []);

  const closeAddQuestionModal = useCallback(() => {
    setAddQuestionModuleId(null);
  }, []);

  const openPreview = useCallback(() => {
    setPreviewOpen(true);
  }, []);

  const closePreview = useCallback(() => {
    setPreviewOpen(false);
  }, []);

  useEffect(() => {
    autoOpenedMainDataRef.current = false;
    setEditMainData(false);
    setAddModuleId(null);
    setAddModuleTargetIndex(null);
    setAddQuestionModuleId(null);
    setPreviewOpen(false);
    setMainDataError(null);
    setConfirm(null);
  }, [copyFromTemplateId, templateId]);

  useEffect(() => {
    if (
      !isNewTemplate ||
      isTemplateLoading ||
      !templateReady ||
      autoOpenedMainDataRef.current
    ) {
      return;
    }

    autoOpenedMainDataRef.current = true;
    openMainDataModal();
  }, [isNewTemplate, isTemplateLoading, openMainDataModal, templateReady]);

  return {
    addModuleId,
    addModuleTargetIndex,
    addQuestionModuleId,
    confirm,
    editMainData,
    mainDataError,
    previewOpen,
    closeAddModuleModal,
    closeAddQuestionModal,
    closeMainDataModal,
    closePreview,
    openAddModuleModal,
    openAddQuestionModal,
    openMainDataModal,
    openPreview,
    setConfirm,
  };
}
