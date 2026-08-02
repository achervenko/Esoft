import { request } from "../api-client";
import type {
  CreateInitialAdminPayload,
  SetupEmployee,
  SetupStatus,
} from "./setup.types";

export function getSetupStatus() {
  return request<SetupStatus>("/api/setup/status", {
    handleUnauthorized: false,
  });
}

export function getSetupEmployees() {
  return request<{ employees: SetupEmployee[] }>("/api/setup/employees", {
    handleUnauthorized: false,
  });
}

export function createInitialAdmin(payload: CreateInitialAdminPayload) {
  return request<{ ok: true }>("/api/setup/admin", {
    body: JSON.stringify(payload),
    handleUnauthorized: false,
    method: "POST",
  });
}
