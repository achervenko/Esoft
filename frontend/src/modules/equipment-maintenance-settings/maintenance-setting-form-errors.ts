type MaintenanceSettingFieldErrors = Partial<
  Record<
    | "defaultChecklistTemplateId"
    | "maintenanceTypeId"
    | "executionType"
    | "periodicity",
    string
  >
>;

export function getFieldErrorsByCode(
  code: string | null,
): MaintenanceSettingFieldErrors {
  switch (code) {
    case "DEFAULT_CHECKLIST_TEMPLATE_REQUIRED":
    case "CHECKLIST_TEMPLATE_NOT_FOUND":
    case "CHECKLIST_TEMPLATE_INACTIVE":
    case "CHECKLIST_TEMPLATE_INVALID":
      return {
        defaultChecklistTemplateId: "Некорректный шаблон чек-листа.",
      };
    case "MAINTENANCE_TYPE_REQUIRED":
    case "MAINTENANCE_TYPE_NOT_FOUND":
    case "MAINTENANCE_TYPE_INACTIVE":
    case "MAINTENANCE_TYPE_ALREADY_EXISTS":
    case "MAINTENANCE_SETTING_ALREADY_EXISTS":
      return { maintenanceTypeId: "Выберите другой вид обслуживания." };
    case "EXECUTION_TYPE_INVALID":
      return { executionType: "Укажите корректный способ выполнения." };
    case "PERIODICITY_FORMAT_CONFLICT":
    case "PERIODICITY_INVALID":
    case "PERIODICITY_VALUE_INVALID":
      return { periodicity: "Укажите корректную периодичность." };
    default:
      return {};
  }
}
