import { toDraftValue } from "../my-checklists.answers";
import type { ChecklistModulesProps } from "../my-checklists.types";
import { ChecklistQuestion } from "./ChecklistQuestion";

export function ChecklistModules({
  canEdit,
  draftAnswers,
  modules,
  onAnswerChange,
  showRequiredErrors,
}: ChecklistModulesProps) {
  return (
    <section className="my-checklists-modules">
      {modules.map((module) => (
        <div className="my-checklists-module" key={module.moduleKey}>
          <h3>{module.name}</h3>
          <div className="my-checklists-module-questions">
            {module.questions.map((question) => {
              const answerValue =
                draftAnswers[question.checklistDetailId] ?? toDraftValue(question);

              return (
                <ChecklistQuestion
                  canEdit={canEdit}
                  key={question.checklistDetailId}
                  onAnswerChange={onAnswerChange}
                  question={question}
                  showRequiredError={showRequiredErrors}
                  value={answerValue}
                />
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
