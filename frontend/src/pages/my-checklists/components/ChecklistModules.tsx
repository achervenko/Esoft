import { ChecklistQuestion } from "./ChecklistQuestion";
import { toDraftValue } from "../my-checklists.answers";
import type { ChecklistModulesProps } from "../my-checklists.types";

export function ChecklistModules({
  canEdit,
  draftAnswers,
  modules,
  onAnswerChange,
}: ChecklistModulesProps) {
  return (
    <section className="my-checklists-modules">
      {modules.map((module) => (
        <section className="my-checklists-module" key={module.moduleKey}>
          <h3>{module.name}</h3>
          <div className="my-checklists-module-questions">
            {module.questions.map((question) => (
              <ChecklistQuestion
                canEdit={canEdit}
                key={question.checklistDetailId}
                onChange={(value) => onAnswerChange(question.checklistDetailId, value)}
                question={question}
                value={draftAnswers[question.checklistDetailId] ?? toDraftValue(question)}
              />
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}
