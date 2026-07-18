import { useEffect, useState } from "react";
import { useChecklistTemplateLoader } from "./useChecklistTemplateLoader";
import { useLocalTemplateState } from "./useLocalTemplateState";
import { useTemplatePersistence } from "./useTemplatePersistence";
import { useTemplateStructureActions } from "./useTemplateStructureActions";

type UseChecklistTemplateEditorParams = {
  copyFromTemplateId?: number | null;
  isAdmin: boolean;
  templateId: number | null;
};

export function useChecklistTemplateEditor({
  copyFromTemplateId = null,
  isAdmin,
  templateId,
}: UseChecklistTemplateEditorParams) {
  const isNewTemplate = templateId === null;
  const isCopyTemplate = isNewTemplate && copyFromTemplateId !== null;
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const loader = useChecklistTemplateLoader({
    copyFromTemplateId,
    isAdmin,
    templateId,
  });
  const localState = useLocalTemplateState({
    isNewTemplate,
    isSaving,
    setError,
    setMessage,
  });
  const {
    getNextLocalId,
    isDirty,
    runLocalMutation,
    setIsDirty,
    setTemplateFromLoad,
    shouldConfirmExit,
    template,
  } = localState;

  useEffect(() => {
    if (loader.isLoading || loader.error) {
      return;
    }

    setTemplateFromLoad(loader.loadedTemplate);
  }, [
    loader.error,
    loader.isLoading,
    loader.loadedTemplate,
    setTemplateFromLoad,
  ]);

  const structureActions = useTemplateStructureActions({
    getNextLocalId,
    isNewTemplate,
    modules: loader.modules,
    questions: loader.questions,
    runLocalMutation,
  });
  const persistence = useTemplatePersistence({
    isNewTemplate,
    isSaving,
    setError,
    setIsDirty,
    setIsSaving,
    setMessage,
    template,
  });

  return {
    error: error ?? loader.error,
    isDirty,
    isEditable: isNewTemplate,
    isLoading: loader.isLoading,
    isCopyTemplate,
    isNewTemplate,
    isSaving,
    message,
    modules: loader.modules,
    questions: loader.questions,
    template,
    ...structureActions,
    ...persistence,
    shouldConfirmExit,
  };
}
