import type { MaintenanceSetting } from "../../shared/api/equipment-api";
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
    label: "Шаблон",
    render: (setting) =>
      setting.checklistTemplateId
        ? `#${setting.checklistTemplateId}`
        : "Не указан",
    sortValue: (setting) => setting.checklistTemplateId ?? 0,
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
