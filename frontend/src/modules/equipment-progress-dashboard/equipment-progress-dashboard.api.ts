import { request } from "../../shared/api/api-client";
import type { EquipmentProgressDashboardDto } from "./equipment-progress-dashboard.types";

export function getEquipmentProgressDashboard() {
  return request<EquipmentProgressDashboardDto>(
    "/api/dashboard/equipment-progress",
  );
}
