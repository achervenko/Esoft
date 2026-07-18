import { useCallback } from "react";
import type {
  ChecklistModule,
  ChecklistQuestion,
  ChecklistTemplateDetail,
} from "../../shared/api/checklists";
import { useTemplateMainDataActions } from "./use-template-main-data-actions";
import type { RunLocalMutation } from "./use-template-main-data-actions";
import { useTemplateModuleActions } from "./use-template-module-actions";
import { useTemplateQuestionActions } from "./use-template-question-actions";

type UseTemplateStructureActionsParams = {
  getNextLocalId: () => number;
  isNewTemplate: boolean;
  modules: ChecklistModule[];
  questions: ChecklistQuestion[];
  runLocalMutation: RunLocalMutation;
};

export function useTemplateStructureActions({
  getNextLocalId,
  isNewTemplate,
  modules,
  questions,
  runLocalMutation,
}: UseTemplateStructureActionsParams) {
  const runEditableMutation = useCallback(
    (
      action: (
        currentTemplate: ChecklistTemplateDetail,
      ) => ChecklistTemplateDetail,
    ) => {
      if (!isNewTemplate) {
        return Promise.resolve(false);
      }

      return runLocalMutation(action);
    },
    [isNewTemplate, runLocalMutation],
  );

  const mainDataActions = useTemplateMainDataActions({
    runLocalMutation: runEditableMutation,
  });
  const moduleActions = useTemplateModuleActions({
    getNextLocalId,
    modules,
    questions,
    runLocalMutation: runEditableMutation,
  });
  const questionActions = useTemplateQuestionActions({
    getNextLocalId,
    questions,
    runLocalMutation: runEditableMutation,
  });

  return {
    ...mainDataActions,
    ...moduleActions,
    ...questionActions,
  };
}
