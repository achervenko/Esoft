export function calculateReorderTargetIndex(
  sourceIndex: number,
  insertionIndex: number,
) {
  if (sourceIndex < 0) {
    return insertionIndex;
  }

  return sourceIndex < insertionIndex ? insertionIndex - 1 : insertionIndex;
}

export function findModuleDomIndex(moduleId: number) {
  const element = document.querySelector<HTMLElement>(
    `[data-template-module-id="${moduleId}"]`,
  );
  return Number(element?.dataset.templateModuleIndex ?? -1);
}

export function findQuestionDomIndex(moduleId: number, questionId: number) {
  const element = document.querySelector<HTMLElement>(
    `[data-template-question-module-id="${moduleId}"][data-template-question-id="${questionId}"]`,
  );
  return Number(element?.dataset.templateQuestionIndex ?? -1);
}
