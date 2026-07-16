import type { MaintenanceSetting } from "../../shared/api/maintenance/maintenance.types";
import { MaintenanceSettingsTable } from "./MaintenanceSettingsTable";

type MaintenanceSettingsPanelStateProps = {
  canManage: boolean;
  isLoading: boolean;
  onDelete: (setting: MaintenanceSetting) => void;
  onEdit: (setting: MaintenanceSetting) => void;
  settings: MaintenanceSetting[] | null;
};

export function MaintenanceSettingsPanelState({
  canManage,
  isLoading,
  onDelete,
  onEdit,
  settings,
}: MaintenanceSettingsPanelStateProps) {
  if (isLoading) {
    return <p className="admin-state">Загрузка...</p>;
  }

  if (settings?.length === 0) {
    return (
      <p className="admin-state">
        Для модели этого оборудования пока нет настроек обслуживания.
      </p>
    );
  }

  if (settings?.length) {
    return (
      <MaintenanceSettingsTable
        canManage={canManage}
        onDelete={onDelete}
        onEdit={onEdit}
        settings={settings}
      />
    );
  }

  return null;
}
