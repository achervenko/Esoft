import {
  getChecklistModules,
  getChecklistQuestions,
  type ChecklistModule,
  type ChecklistQuestion,
} from "../../shared/api/checklists";

const CATALOG_PAGE_LIMIT = 100;

export async function loadAllChecklistModules(
  params: { isActive?: boolean } = {},
) {
  const modules: ChecklistModule[] = [];
  let page = 1;
  let total = 0;

  do {
    const response = await getChecklistModules({
      ...params,
      limit: CATALOG_PAGE_LIMIT,
      page,
      sortBy: "sortOrder",
      sortDirection: "asc",
    });

    if (response.items.length === 0) {
      break;
    }

    modules.push(...response.items);
    total = response.total;
    page += 1;
  } while (modules.length < total);

  return modules;
}

export async function loadAllChecklistQuestions(
  params: { isActive?: boolean } = {},
) {
  const questions: ChecklistQuestion[] = [];
  let page = 1;
  let total = 0;

  do {
    const response = await getChecklistQuestions({
      ...params,
      limit: CATALOG_PAGE_LIMIT,
      page,
      sortBy: "sortOrder",
      sortDirection: "asc",
    });

    if (response.items.length === 0) {
      break;
    }

    questions.push(...response.items);
    total = response.total;
    page += 1;
  } while (questions.length < total);

  return questions;
}
