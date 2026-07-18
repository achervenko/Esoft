import { useCallback } from "react";
import type { ChecklistQuestion } from "../../shared/api/checklists";
import { createLocalTemplateQuestion } from "./checklist-template-editor.factory";
import {
  moveItemToIndex,
  normalizeModuleOrder,
  normalizeQuestionOrder,
} from "./checklist-template-editor.normalize";
import {
  getCatalogQuestionOrder,
  sortCatalogQuestions,
} from "./checklist-template-editor-order";
import type { RunLocalMutation } from "./use-template-main-data-actions";

type UseTemplateQuestionActionsParams = {
  getNextLocalId: () => number;
  questions: ChecklistQuestion[];
  runLocalMutation: RunLocalMutation;
};

export function useTemplateQuestionActions({
  getNextLocalId,
  questions,
  runLocalMutation,
}: UseTemplateQuestionActionsParams) {
  const addQuestions = useCallback(
    async (templateModuleId: number, checklistQuestionIds: number[]) =>
      runLocalMutation((currentTemplate) => ({
        ...currentTemplate,
        modules: currentTemplate.modules.map((module) => {
          if (module.id !== templateModuleId) {
            return module;
          }

          const selectedQuestions = checklistQuestionIds
            .map((questionId) =>
              questions.find(
                (question) =>
                  question.id === questionId &&
                  question.module?.id === module.checklistModuleId,
              ),
            )
            .filter((question): question is ChecklistQuestion =>
              Boolean(question),
            );
          const nextQuestions = [
            ...module.questions,
            ...selectedQuestions
              .sort(sortCatalogQuestions)
              .map((question, index) =>
                createLocalTemplateQuestion(
                  question,
                  module.questions.length + index + 1,
                  getNextLocalId,
                ),
              ),
          ].sort((left, right) => {
            const leftCatalogOrder = getCatalogQuestionOrder(
              questions,
              left.checklistQuestionId,
            );
            const rightCatalogOrder = getCatalogQuestionOrder(
              questions,
              right.checklistQuestionId,
            );

            return (
              leftCatalogOrder - rightCatalogOrder ||
              left.sortOrder - right.sortOrder ||
              left.id - right.id
            );
          });

          return {
            ...module,
            questions: normalizeQuestionOrder(nextQuestions),
          };
        }),
      })),
    [getNextLocalId, questions, runLocalMutation],
  );

  const removeQuestion = useCallback(
    async (templateQuestionId: number) =>
      runLocalMutation((currentTemplate) => ({
        ...currentTemplate,
        modules: normalizeModuleOrder(
          currentTemplate.modules.flatMap((module) => {
            const questions = normalizeQuestionOrder(
              module.questions.filter(
                (question) => question.id !== templateQuestionId,
              ),
            );

            return questions.length > 0 ? [{ ...module, questions }] : [];
          }),
        ),
      })),
    [runLocalMutation],
  );

  const toggleRequired = useCallback(
    async (templateQuestionId: number, isRequired: boolean) =>
      runLocalMutation((currentTemplate) => ({
        ...currentTemplate,
        modules: currentTemplate.modules.map((module) => ({
          ...module,
          questions: module.questions.map((question) =>
            question.id === templateQuestionId
              ? { ...question, isRequired }
              : question,
          ),
        })),
      })),
    [runLocalMutation],
  );

  const reorderQuestions = useCallback(
    async (
      templateModuleId: number,
      templateQuestionId: number,
      targetIndex: number,
    ) =>
      runLocalMutation((currentTemplate) => ({
        ...currentTemplate,
        modules: currentTemplate.modules.map((module) => {
          if (module.id !== templateModuleId) {
            return module;
          }

          const sourceIndex = module.questions.findIndex(
            (question) => question.id === templateQuestionId,
          );
          const questions = moveItemToIndex(
            module.questions,
            sourceIndex,
            targetIndex,
          );

          if (questions === module.questions) {
            return module;
          }

          return {
            ...module,
            questions: normalizeQuestionOrder(questions),
          };
        }),
      })),
    [runLocalMutation],
  );

  return {
    addQuestions,
    removeQuestion,
    reorderQuestions,
    toggleRequired,
  };
}
