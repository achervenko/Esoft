import { useCallback } from "react";
import type {
  ChecklistModule,
  ChecklistQuestion,
} from "../../shared/api/checklists";
import { createLocalTemplateQuestion } from "./checklist-template-editor.factory";
import {
  moveItemToIndex,
  normalizeModuleOrder,
  normalizeQuestionOrder,
} from "./checklist-template-editor.normalize";
import {
  clampIndex,
  sortCatalogQuestions,
} from "./checklist-template-editor-order";
import type { RunLocalMutation } from "./use-template-main-data-actions";

type UseTemplateModuleActionsParams = {
  getNextLocalId: () => number;
  modules: ChecklistModule[];
  questions: ChecklistQuestion[];
  runLocalMutation: RunLocalMutation;
};

export function useTemplateModuleActions({
  getNextLocalId,
  modules,
  questions,
  runLocalMutation,
}: UseTemplateModuleActionsParams) {
  const addModuleWithQuestions = useCallback(
    async (
      checklistModuleId: number,
      questionIds: number[],
      targetIndex?: number,
    ) =>
      runLocalMutation((currentTemplate) => {
        const sourceModule = modules.find(
          (module) => module.id === checklistModuleId,
        );

        if (!sourceModule) {
          return currentTemplate;
        }

        if (
          currentTemplate.modules.some(
            (module) => module.checklistModuleId === checklistModuleId,
          )
        ) {
          return currentTemplate;
        }

        const selectedQuestions = questionIds
          .map((questionId) =>
            questions.find(
              (question) =>
                question.id === questionId &&
                question.checklistModuleId === checklistModuleId,
            ),
          )
          .filter((question): question is ChecklistQuestion => Boolean(question))
          .sort(sortCatalogQuestions);

        if (selectedQuestions.length === 0) {
          return currentTemplate;
        }

        const insertionIndex = clampIndex(
          targetIndex ?? currentTemplate.modules.length,
          currentTemplate.modules.length,
        );
        const nextModule = {
          checklistModuleId: sourceModule.id,
          id: getNextLocalId(),
          name: sourceModule.name,
          questions: normalizeQuestionOrder(
            selectedQuestions.map((question, index) =>
              createLocalTemplateQuestion(question, index + 1, getNextLocalId),
            ),
          ),
          sortOrder: insertionIndex + 1,
        };

        return {
          ...currentTemplate,
          modules: normalizeModuleOrder([
            ...currentTemplate.modules.slice(0, insertionIndex),
            nextModule,
            ...currentTemplate.modules.slice(insertionIndex),
          ]),
        };
      }),
    [getNextLocalId, modules, questions, runLocalMutation],
  );

  const removeModule = useCallback(
    async (templateModuleId: number) =>
      runLocalMutation((currentTemplate) => ({
        ...currentTemplate,
        modules: normalizeModuleOrder(
          currentTemplate.modules.filter(
            (module) => module.id !== templateModuleId,
          ),
        ),
      })),
    [runLocalMutation],
  );

  const reorderModules = useCallback(
    async (templateModuleId: number, targetIndex: number) =>
      runLocalMutation((currentTemplate) => {
        const sourceIndex = currentTemplate.modules.findIndex(
          (module) => module.id === templateModuleId,
        );
        const modules = moveItemToIndex(
          currentTemplate.modules,
          sourceIndex,
          targetIndex,
        );

        if (modules === currentTemplate.modules) {
          return currentTemplate;
        }

        return {
          ...currentTemplate,
          modules: normalizeModuleOrder(modules),
        };
      }),
    [runLocalMutation],
  );

  return {
    addModuleWithQuestions,
    removeModule,
    reorderModules,
  };
}
