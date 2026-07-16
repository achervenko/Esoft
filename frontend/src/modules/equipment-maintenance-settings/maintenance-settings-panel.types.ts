import type { MaintenanceSetting } from "../../shared/api/maintenance/maintenance.types";

export type MaintenanceSettingsPanelProps = {
  canManage: boolean;
  visibleId: number;
};

export type MaintenanceSettingsPanelActiveForm =
  | { mode: "create"; setting?: null }
  | { mode: "edit"; setting: MaintenanceSetting };

export type MaintenanceSettingsPanelModalState = {
  activeForm: MaintenanceSettingsPanelActiveForm | null;
  deleteCandidate: MaintenanceSetting | null;
};
