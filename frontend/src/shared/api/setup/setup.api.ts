import { request } from "../api-client";
import type {
  CreateInitialAdminPayload,
  SetupEmployee,
  SetupStatus,
} from "./setup.types";

export function getSetupStatus() {
  return request<SetupStatus>("/api/setup/status");
}

export function getSetupEmployees() {
  return request<{ employees: SetupEmployee[] }>("/api/setup/employees");
}

export function createInitialAdmin(payload: CreateInitialAdminPayload) {
  return request<{ ok: true }>("/api/setup/admin", {
    body: JSON.stringify(payload),
    method: "POST",
  });
}
