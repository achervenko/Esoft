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

function formatChecklistTemplate(setting: MaintenanceSetting) {
  if (!setting.defaultChecklistTemplate) {
    return "Шаблон не назначен";
  }

  if (setting.defaultChecklistTemplate.state === "ARCHIVED") {
    return `${setting.defaultChecklistTemplate.name} (Шаблон удалён)`;
  }

  return setting.defaultChecklistTemplate.name;
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
    label: "Шаблон по умолчанию",
    render: (setting) => formatChecklistTemplate(setting),
    sortValue: formatChecklistTemplate,
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
