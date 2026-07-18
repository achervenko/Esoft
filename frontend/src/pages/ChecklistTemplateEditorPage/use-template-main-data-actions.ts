import { useCallback } from "react";
import type { ChecklistTemplateDetail } from "../../shared/api/checklists";

export type RunLocalMutation = (
  action: (currentTemplate: ChecklistTemplateDetail) => ChecklistTemplateDetail,
) => Promise<boolean>;

type UseTemplateMainDataActionsParams = {
  runLocalMutation: RunLocalMutation;
};

export function useTemplateMainDataActions({
  runLocalMutation,
}: UseTemplateMainDataActionsParams) {
  const updateMainData = useCallback(
    async (payload: { description?: string | null; name: string }) =>
      runLocalMutation((currentTemplate) => ({
        ...currentTemplate,
        description: payload.description ?? null,
        name: payload.name,
      })),
    [runLocalMutation],
  );

  return { updateMainData };
}
