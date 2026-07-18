import type { ChecklistModule, ChecklistQuestion } from "../../shared/api/checklists";
import {
  sortModulesForCatalog,
  sortQuestionsForCatalog,
} from "./checklist-catalog.order";

export function upsertModule(
  modules: ChecklistModule[],
  module: ChecklistModule,
) {
  const hasModule = modules.some((currentModule) => currentModule.id === module.id);

  return (hasModule
    ? modules.map((currentModule) =>
        currentModule.id === module.id ? module : currentModule,
      )
    : modules.concat(module)
  ).sort(sortModulesForCatalog);
}

export function upsertQuestion(
  questions: ChecklistQuestion[],
  question: ChecklistQuestion,
) {
  const hasQuestion = questions.some(
    (currentQuestion) => currentQuestion.id === question.id,
  );

  return (hasQuestion
    ? questions.map((currentQuestion) =>
        currentQuestion.id === question.id ? question : currentQuestion,
      )
    : questions.concat(question)
  ).sort(sortQuestionsForCatalog);
}

export function updateQuestionModuleSummaries(
  questions: ChecklistQuestion[],
  module: ChecklistModule,
) {
  return questions.map((question) =>
    question.checklistModuleId === module.id
      ? {
          ...question,
          module: {
            id: module.id,
            isActive: module.isActive,
            name: module.name,
          },
        }
      : question,
  );
}
