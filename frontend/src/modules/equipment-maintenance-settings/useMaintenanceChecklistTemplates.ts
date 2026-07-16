import { useCallback, useEffect, useRef, useState } from "react";
import type { MaintenanceSettingChecklistTemplate } from "../../shared/api/maintenance/maintenance.types";
import {
  createEmptyChecklistTemplateFormItem,
  toChecklistTemplateFormItems,
  type ChecklistTemplateFormItem,
} from "./maintenance-setting-form-utils";

type ChecklistTemplateUpdate = Partial<
  Pick<ChecklistTemplateFormItem, "checklistTemplateId" | "isRequired">
>;

type UseMaintenanceChecklistTemplatesParams = {
  initialTemplates: MaintenanceSettingChecklistTemplate[];
  onChange: () => void;
  resetKey: string;
};

export function useMaintenanceChecklistTemplates({
  initialTemplates,
  onChange,
  resetKey,
}: UseMaintenanceChecklistTemplatesParams) {
  const initialTemplatesRef = useRef(initialTemplates);
  const [checklistTemplates, setChecklistTemplates] = useState<
    ChecklistTemplateFormItem[]
  >(() => toChecklistTemplateFormItems(initialTemplates));

  initialTemplatesRef.current = initialTemplates;

  useEffect(() => {
    setChecklistTemplates(
      toChecklistTemplateFormItems(initialTemplatesRef.current),
    );
  }, [resetKey]);

  const addChecklistTemplate = useCallback(() => {
    setChecklistTemplates((currentItems) => [
      ...currentItems,
      createEmptyChecklistTemplateFormItem(currentItems.length),
    ]);
    onChange();
  }, [onChange]);

  const removeChecklistTemplate = useCallback(
    (clientId: string) => {
      setChecklistTemplates((currentItems) =>
        currentItems.filter((item) => item.clientId !== clientId),
      );
      onChange();
    },
    [onChange],
  );

  const updateChecklistTemplate = useCallback(
    (clientId: string, value: ChecklistTemplateUpdate) => {
      setChecklistTemplates((currentItems) =>
        currentItems.map((item) =>
          item.clientId === clientId ? { ...item, ...value } : item,
        ),
      );
      onChange();
    },
    [onChange],
  );

  const moveChecklistTemplate = useCallback(
    (clientId: string, direction: -1 | 1) => {
      const currentIndex = checklistTemplates.findIndex(
        (item) => item.clientId === clientId,
      );
      const nextIndex = currentIndex + direction;

      if (
        currentIndex < 0 ||
        nextIndex < 0 ||
        nextIndex >= checklistTemplates.length
      ) {
        return;
      }

      const nextItems = [...checklistTemplates];
      [nextItems[currentIndex], nextItems[nextIndex]] = [
        nextItems[nextIndex],
        nextItems[currentIndex],
      ];

      setChecklistTemplates(nextItems);
      onChange();
    },
    [checklistTemplates, onChange],
  );

  return {
    addChecklistTemplate,
    checklistTemplates,
    moveChecklistTemplate,
    removeChecklistTemplate,
    updateChecklistTemplate,
  };
}
