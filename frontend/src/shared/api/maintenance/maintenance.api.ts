import { request } from "../api-client";
import type {
  AvailableMaintenanceTypesResponse,
  MaintenanceSettingPayload,
  MaintenanceSettingsResponse,
  MaintenanceSettingUpdatePayload,
} from "./maintenance.types";

export function getMaintenanceSettings(visibleId: number) {
  return request<MaintenanceSettingsResponse>(
    `/api/equipment/${visibleId}/maintenance-settings`,
  );
}

export function getAvailableMaintenanceTypes(visibleId: number) {
  return request<AvailableMaintenanceTypesResponse>(
    `/api/equipment/${visibleId}/maintenance-settings/available-types`,
  );
}

export function createMaintenanceSetting(
  visibleId: number,
  payload: MaintenanceSettingPayload,
) {
  return request<MaintenanceSettingsResponse>(
    `/api/equipment/${visibleId}/maintenance-settings`,
    {
      body: JSON.stringify(payload),
      method: "POST",
    },
  );
}

export function updateMaintenanceSetting(
  visibleId: number,
  settingId: number,
  payload: MaintenanceSettingUpdatePayload,
) {
  return request<MaintenanceSettingsResponse>(
    `/api/equipment/${visibleId}/maintenance-settings/${settingId}`,
    {
      body: JSON.stringify(payload),
      method: "PATCH",
    },
  );
}

export function deleteMaintenanceSetting(
  visibleId: number,
  settingId: number,
) {
  return request<MaintenanceSettingsResponse>(
    `/api/equipment/${visibleId}/maintenance-settings/${settingId}`,
    {
      method: "DELETE",
    },
  );
}
