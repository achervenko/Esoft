type MaintenanceSettingFieldErrors = Partial<
  Record<
    | "checklistTemplates"
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
    case "CHECKLIST_TEMPLATES_INVALID":
    case "CHECKLIST_TEMPLATE_INVALID":
    case "CHECKLIST_TEMPLATE_ID_INVALID":
    case "CHECKLIST_TEMPLATE_REQUIRED_INVALID":
    case "CHECKLIST_TEMPLATE_SORT_ORDER_INVALID":
    case "CHECKLIST_TEMPLATE_DUPLICATE":
    case "CHECKLIST_TEMPLATE_SORT_ORDER_DUPLICATE":
    case "CHECKLIST_TEMPLATE_SORT_ORDER_SEQUENCE_INVALID":
      return { checklistTemplates: "Некорректный шаблон чек-листа." };
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
