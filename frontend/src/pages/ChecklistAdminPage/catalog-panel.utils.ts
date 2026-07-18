import type { SyntheticEvent } from "react";
import type { ChecklistModule } from "../../shared/api/checklists";
import type { SelectedQuestionGroup } from "./checklist-catalog.types";

export function getNormalizedCatalogSearch(search: string) {
  return search.trim().toLocaleLowerCase("ru-RU");
}

export function filterCatalogModules(
  modules: ChecklistModule[],
  normalizedSearch: string,
) {
  if (!normalizedSearch) {
    return modules;
  }

  return modules.filter((module) =>
    module.name.toLocaleLowerCase("ru-RU").includes(normalizedSearch),
  );
}

export function getCatalogQuestionsTitle(
  selectedGroup: SelectedQuestionGroup,
  selectedModuleName: string | null,
) {
  return selectedGroup.kind === "unassigned"
    ? "Вопросы без модуля"
    : selectedModuleName ?? "";
}

export function stopCardEvent(event: SyntheticEvent) {
  event.stopPropagation();
}
