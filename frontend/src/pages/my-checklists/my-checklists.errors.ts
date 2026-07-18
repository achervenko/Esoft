import { ApiRequestError, getApiErrorMessage } from "../../shared/api/api-error";
import type { MyChecklistActionErrorResult } from "./my-checklists.types";

const VERSION_CONFLICT_MESSAGE =
  "Чек-лист уже был изменён. Перезагрузите карточку, чтобы продолжить работу с актуальной версией.";

export function mapChecklistActionError(
  error: unknown,
  target: "detail" | "form",
): MyChecklistActionErrorResult {
  if (
    error instanceof ApiRequestError &&
    error.code === "CHECKLIST_VERSION_CONFLICT"
  ) {
    return {
      detailError: null,
      formError: null,
      versionConflict: VERSION_CONFLICT_MESSAGE,
    };
  }

  return {
    detailError: target === "detail" ? getApiErrorMessage(error) : null,
    formError: target === "form" ? getApiErrorMessage(error) : null,
    versionConflict: null,
  };
}
