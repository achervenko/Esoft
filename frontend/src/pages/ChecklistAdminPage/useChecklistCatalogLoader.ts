import { useCallback, useEffect, useRef } from "react";
import {
  getChecklistAdminErrorMessage,
  getChecklistModules,
  getChecklistQuestions,
  type ChecklistModule,
  type ChecklistQuestion,
} from "../../shared/api/checklists";
import {
  sortModulesForCatalog,
  sortQuestionsForCatalog,
} from "./checklist-catalog.order";
import type { ChecklistCatalogLoaderState } from "./checklist-catalog.types";

const CATALOG_PAGE_LIMIT = 100;

export function useChecklistCatalogLoader({
  enabled,
  state,
}: {
  enabled: boolean;
  state: ChecklistCatalogLoaderState;
}) {
  const requestIdRef = useRef(0);
  const hasLoadedRef = useRef(false);
  const {
    setError,
    setIsLoading,
    setIsRefreshing,
    setModules,
    setQuestions,
    setSelectedGroup,
  } = state;

  const loadCatalog = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const isInitialRequest = !hasLoadedRef.current;

    setIsLoading(isInitialRequest);
    setIsRefreshing(!isInitialRequest);
    setError(null);

    try {
      const [loadedModules, loadedQuestions] = await Promise.all([
        loadAllChecklistModules(),
        loadAllChecklistQuestions(),
      ]);

      if (requestIdRef.current !== requestId) {
        return;
      }

      const sortedModules = loadedModules.sort(sortModulesForCatalog);
      const sortedQuestions = loadedQuestions.sort(sortQuestionsForCatalog);
      const hasUnassignedQuestions = sortedQuestions.some(
        (question) => question.checklistModuleId === null,
      );

      hasLoadedRef.current = true;
      setModules(sortedModules);
      setQuestions(sortedQuestions);
      setSelectedGroup((currentGroup) => {
        if (
          currentGroup.kind === "module" &&
          sortedModules.some(
            (module) => module.id === currentGroup.moduleId && module.isActive,
          )
        ) {
          return currentGroup;
        }

        if (hasUnassignedQuestions) {
          return { kind: "unassigned" };
        }

        const firstActiveModule = sortedModules.find((module) => module.isActive);

        return firstActiveModule
          ? { kind: "module", moduleId: firstActiveModule.id }
          : { kind: "unassigned" };
      });
    } catch (requestError) {
      if (requestIdRef.current === requestId) {
        setError(getChecklistAdminErrorMessage(requestError));
      }
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [
    setError,
    setIsLoading,
    setIsRefreshing,
    setModules,
    setQuestions,
    setSelectedGroup,
  ]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    void loadCatalog();
  }, [enabled, loadCatalog]);

  return {
    reload: loadCatalog,
  };
}

async function loadAllChecklistModules() {
  const modules: ChecklistModule[] = [];
  let page = 1;
  let total = 0;

  do {
    const response = await getChecklistModules({
      limit: CATALOG_PAGE_LIMIT,
      page,
      sortBy: "sortOrder",
      sortDirection: "asc",
    });

    modules.push(...response.items);
    total = response.total;
    page += 1;
  } while (modules.length < total);

  return modules;
}

async function loadAllChecklistQuestions() {
  const questions: ChecklistQuestion[] = [];
  let page = 1;
  let total = 0;

  do {
    const response = await getChecklistQuestions({
      limit: CATALOG_PAGE_LIMIT,
      page,
      sortBy: "sortOrder",
      sortDirection: "asc",
    });

    questions.push(...response.items);
    total = response.total;
    page += 1;
  } while (questions.length < total);

  return questions;
}
