import { request } from "../api-client";
import type {
  ChecklistModule,
  ChecklistModulePayload,
  ChecklistPageResponse,
  ChecklistQuestion,
  ChecklistQuestionPayload,
  ChecklistReorderItem,
  ChecklistTemplateDetail,
  ChecklistTemplateArchiveResponse,
  ChecklistTemplateDetailResponse,
  ChecklistTemplateListItem,
  ChecklistTemplatePayload,
  ChecklistWorkAnswersPayload,
  ChecklistWorkCompletePayload,
  ChecklistWorkDetail,
  ChecklistWorkListResponse,
  ChecklistWorkQuery,
  ChecklistWorkProgressResponse,
  ChecklistWorkVersionPayload,
} from "./checklists.types";

type QueryValue = boolean | number | string | null | undefined;

function toQuery(params: Record<string, QueryValue>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function getChecklistModules(params: Record<string, QueryValue> = {}) {
  return request<ChecklistPageResponse<ChecklistModule>>(
    `/api/checklist-modules${toQuery(params)}`,
  );
}

export function createChecklistModule(payload: ChecklistModulePayload) {
  return request<{ module: ChecklistModule }>("/api/checklist-modules", {
    body: JSON.stringify(payload),
    method: "POST",
  });
}

export function updateChecklistModule(
  id: number,
  payload: ChecklistModulePayload,
) {
  return request<{ module: ChecklistModule }>(`/api/checklist-modules/${id}`, {
    body: JSON.stringify(payload),
    method: "PATCH",
  });
}

export function activateChecklistModule(id: number) {
  return request<{ module: ChecklistModule }>(
    `/api/checklist-modules/${id}/activate`,
    {
      method: "POST",
    },
  );
}

export function deactivateChecklistModule(id: number) {
  return request<{ module: ChecklistModule }>(
    `/api/checklist-modules/${id}/deactivate`,
    {
      method: "POST",
    },
  );
}

export function reorderChecklistModules(items: ChecklistReorderItem[]) {
  return request<{ modules: ChecklistModule[] }>(
    "/api/checklist-modules/reorder",
    {
      body: JSON.stringify({ items }),
      method: "PATCH",
    },
  );
}

export function getChecklistQuestions(params: Record<string, QueryValue> = {}) {
  return request<ChecklistPageResponse<ChecklistQuestion>>(
    `/api/checklist-questions${toQuery(params)}`,
  );
}

export function createChecklistQuestion(payload: ChecklistQuestionPayload) {
  return request<{ question: ChecklistQuestion }>("/api/checklist-questions", {
    body: JSON.stringify(payload),
    method: "POST",
  });
}

export function updateChecklistQuestion(
  id: number,
  payload: ChecklistQuestionPayload,
) {
  return request<{ question: ChecklistQuestion }>(
    `/api/checklist-questions/${id}`,
    {
      body: JSON.stringify(payload),
      method: "PATCH",
    },
  );
}

export function activateChecklistQuestion(id: number) {
  return request<{ question: ChecklistQuestion }>(
    `/api/checklist-questions/${id}/activate`,
    {
      method: "POST",
    },
  );
}

export function deactivateChecklistQuestion(id: number) {
  return request<{ question: ChecklistQuestion }>(
    `/api/checklist-questions/${id}/deactivate`,
    {
      method: "POST",
    },
  );
}

export function reorderChecklistQuestions(
  moduleId: number,
  items: ChecklistReorderItem[],
) {
  return request<{ questions: ChecklistQuestion[] }>(
    `/api/checklist-modules/${moduleId}/questions/reorder`,
    {
      body: JSON.stringify({ items }),
      method: "PATCH",
    },
  );
}

export function getChecklistTemplates(params: Record<string, QueryValue> = {}) {
  return request<ChecklistPageResponse<ChecklistTemplateListItem>>(
    `/api/checklist-templates${toQuery(params)}`,
  );
}

export function getChecklistTemplate(id: number) {
  return request<ChecklistTemplateDetailResponse>(
    `/api/checklist-templates/${id}`,
  );
}

export function createChecklistTemplate(payload: ChecklistTemplatePayload) {
  return request<{ template: ChecklistTemplateDetail }>(
    "/api/checklist-templates",
    {
      body: JSON.stringify(payload),
      method: "POST",
    },
  );
}

export function archiveChecklistTemplate(
  id: number,
  version: number,
  reason: string,
) {
  return request<ChecklistTemplateArchiveResponse>(
    `/api/checklist-templates/${id}/archive`,
    {
      body: JSON.stringify({ reason, version }),
      method: "POST",
    },
  );
}

export function getChecklistWorkItems(query: ChecklistWorkQuery = {}) {
  const status = Array.isArray(query.status)
    ? query.status.join(",")
    : query.status;

  return request<ChecklistWorkListResponse>(
    `/api/checklists${toQuery({
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      equipmentVisibleId: query.equipmentVisibleId,
      eventId: query.eventId,
      limit: query.limit,
      offset: query.offset,
      status,
    })}`,
  );
}

export function getChecklistWorkDetail(id: number) {
  return request<ChecklistWorkDetail>(`/api/checklists/${id}`);
}

export function startChecklistWork(
  id: number,
  payload: ChecklistWorkVersionPayload,
) {
  return request<ChecklistWorkDetail>(`/api/checklists/${id}/start`, {
    body: JSON.stringify(payload),
    method: "POST",
  });
}

export function saveChecklistWorkAnswers(
  id: number,
  payload: ChecklistWorkAnswersPayload,
) {
  return request<ChecklistWorkProgressResponse>(
    `/api/checklists/${id}/answers`,
    {
      body: JSON.stringify(payload),
      method: "PATCH",
    },
  );
}

export function completeChecklistWork(
  id: number,
  payload: ChecklistWorkCompletePayload,
) {
  return request<ChecklistWorkDetail>(`/api/checklists/${id}/complete`, {
    body: JSON.stringify(payload),
    method: "POST",
  });
}
