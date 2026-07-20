import type { UserPhoto } from "./user-profile-api";

export type AdminRoleOption = {
  label: string;
  value: AdminUserRole;
};

export type AdminUserRole =
  "admin" | "chief_engineer" | "engineer" | "operator" | "auditor";

export type AdminEmployee = {
  accountCount: number;
  equipmentCount: number;
  firstName: string;
  fullName: string;
  id: number;
  isActive: boolean;
  lastName: string;
  middleName: string | null;
  position: string;
};

export type AdminUserAccount = {
  banned: boolean;
  createdAt: string;
  displayUsername: string | null;
  email: string;
  employee: {
    fullName: string;
    id: number;
    position: string;
  } | null;
  id: string;
  lastLoginAt: string | null;
  name: string;
  photo: UserPhoto | null;
  role: AdminUserRole | string | null;
  roleLabel: string;
  username: string | null;
};

export type EmployeePayload = {
  firstName: string;
  lastName: string;
  middleName?: string | null;
  position: string;
};

export type UserAccountPayload = {
  email: string;
  employeeId: number;
  password?: string;
  role: AdminUserRole;
  username: string;
};

const API_URL = import.meta.env.VITE_API_URL || "";

export class AdminApiError extends Error {
  readonly code?: string;
  readonly status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "AdminApiError";
    this.code = code;
    this.status = status;
  }
}

export function getAdminRoles() {
  return request<AdminRoleOption[]>("/api/users/admin/roles");
}

export function getAdminEmployees() {
  return request<AdminEmployee[]>("/api/users/admin/employees");
}

export function createAdminEmployee(payload: EmployeePayload) {
  return request<AdminEmployee>("/api/users/admin/employees", {
    body: JSON.stringify(payload),
    method: "POST",
  });
}

export function updateAdminEmployee(id: number, payload: EmployeePayload) {
  return request<AdminEmployee>(`/api/users/admin/employees/${id}`, {
    body: JSON.stringify(payload),
    method: "PUT",
  });
}

export function setAdminEmployeeStatus(id: number, isActive: boolean) {
  return request<AdminEmployee>(`/api/users/admin/employees/${id}/status`, {
    body: JSON.stringify({ isActive }),
    method: "PATCH",
  });
}

export function getAdminUserAccounts() {
  return request<AdminUserAccount[]>("/api/users/admin/accounts");
}

export function createAdminUserAccount(payload: Required<UserAccountPayload>) {
  return request<AdminUserAccount>("/api/users/admin/accounts", {
    body: JSON.stringify(payload),
    method: "POST",
  });
}

export function updateAdminUserAccount(
  id: string,
  payload: Omit<UserAccountPayload, "password">,
) {
  return request<AdminUserAccount>(`/api/users/admin/accounts/${id}`, {
    body: JSON.stringify(payload),
    method: "PUT",
  });
}

export function setAdminUserPassword(id: string, password: string) {
  return request<{ ok: true }>(`/api/users/admin/accounts/${id}/password`, {
    body: JSON.stringify({ password }),
    method: "PATCH",
  });
}

export function setAdminUserStatus(id: string, banned: boolean) {
  return request<AdminUserAccount>(`/api/users/admin/accounts/${id}/status`, {
    body: JSON.stringify({ banned }),
    method: "PATCH",
  });
}

export function uploadAdminUserPhoto(id: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  return request<AdminUserAccount>(`/api/users/admin/accounts/${id}/photo`, {
    body: formData,
    method: "POST",
  });
}

export function deleteAdminUserPhoto(id: string) {
  return request<AdminUserAccount>(`/api/users/admin/accounts/${id}/photo`, {
    method: "DELETE",
  });
}

async function request<T>(path: string, init?: RequestInit) {
  const isFormData = init?.body instanceof FormData;
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: isFormData
      ? init?.headers
      : {
          "Content-Type": "application/json",
          ...init?.headers,
        },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);

    throw new AdminApiError(
      errorBody?.message ?? "Не удалось выполнить запрос.",
      response.status,
      errorBody?.code,
    );
  }

  return (await response.json()) as T;
}
