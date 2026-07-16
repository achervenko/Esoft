import type { MaintenanceSetting } from "../../shared/api/maintenance/maintenance.types";
import { AdminTableActions } from "../../shared/ui/AdminTableActions";
import { DataTable, type DataTableColumn } from "../../shared/ui/DataTable";
import {
  executionTypeLabels,
  formatMaintenancePeriodicity,
} from "./maintenance-settings-utils";

type MaintenanceSettingsTableProps = {
  canManage: boolean;
  onDelete: (setting: MaintenanceSetting) => void;
  onEdit: (setting: MaintenanceSetting) => void;
  settings: MaintenanceSetting[];
};

function getSortedChecklistTemplates(setting: MaintenanceSetting) {
  return [...setting.checklistTemplates].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder ||
      left.checklistTemplateId - right.checklistTemplateId,
  );
}

function formatChecklistTemplatesSortValue(setting: MaintenanceSetting) {
  return getSortedChecklistTemplates(setting)
    .map((template) => `${template.name} #${template.checklistTemplateId}`)
    .join(", ");
}

const columns = (
  canManage: boolean,
  onEdit: (setting: MaintenanceSetting) => void,
  onDelete: (setting: MaintenanceSetting) => void,
): Array<DataTableColumn<MaintenanceSetting, string>> => [
  {
    key: "maintenanceType",
    label: "Вид обслуживания",
    render: (setting) => (
      <strong>
        {setting.maintenanceType.name}
        {!setting.maintenanceType.isActive ? <small>Отключён</small> : null}
      </strong>
    ),
    sortValue: (setting) => setting.maintenanceType.name,
  },
  {
    key: "executionType",
    label: "Выполнение",
    render: (setting) => executionTypeLabels[setting.executionType],
    sortValue: (setting) => executionTypeLabels[setting.executionType],
  },
  {
    key: "periodicity",
    label: "Периодичность",
    render: (setting) => formatMaintenancePeriodicity(setting.periodicity),
    sortValue: (setting) => formatMaintenancePeriodicity(setting.periodicity),
  },
  {
    key: "checklistTemplate",
    label: "Шаблоны",
    render: (setting) =>
      setting.checklistTemplates.length > 0 ? (
        <div className="maintenance-settings-checklist-list">
          {getSortedChecklistTemplates(setting).map((template) => (
            <span key={template.checklistTemplateId}>
              {template.name} #{template.checklistTemplateId} (
              {template.isRequired ? "обязательный" : "необязательный"})
            </span>
          ))}
        </div>
      ) : (
        "Не назначены"
      ),
    sortValue: formatChecklistTemplatesSortValue,
  },
  ...(canManage
    ? [
        {
          key: "actions",
          label: "",
          render: (setting: MaintenanceSetting) => (
            <AdminTableActions
              deleteLabel={`Удалить настройку ${setting.maintenanceType.name}`}
              editLabel={`Редактировать настройку ${setting.maintenanceType.name}`}
              onDelete={() => onDelete(setting)}
              onEdit={() => onEdit(setting)}
            />
          ),
        },
      ]
    : []),
];

export function MaintenanceSettingsTable({
  canManage,
  onDelete,
  onEdit,
  settings,
}: MaintenanceSettingsTableProps) {
  return (
    <DataTable
      columns={columns(canManage, onEdit, onDelete)}
      defaultSort={{ direction: "asc", key: "maintenanceType" }}
      getRowKey={(setting) => setting.id}
      rows={settings}
    />
  );
}
