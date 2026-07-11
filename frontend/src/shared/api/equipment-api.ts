import { downloadFileById, getFileDownloadUrl } from "./files-api";

export type OptionItem = {
  id: number;
  name: string;
  position?: string;
};

export type EquipmentStatusOption = {
  label: string;
  value: string;
};

export type EquipmentCreateOptions = {
  countries: OptionItem[];
  employees: OptionItem[];
  manufacturers: OptionItem[];
  nextVisibleId: number;
  sections: OptionItem[];
  statuses: EquipmentStatusOption[];
};

export type CreateEquipmentPayload = {
  visibleId?: number;
  name: string;
  manufacturerId?: number | null;
  model?: string | null;
  specifications?: string | null;
  serialNumber?: string | null;
  inventoryNumber: string;
  countryId?: number | null;
  manufactureYear?: number | null;
  commissioningDate?: string | null;
  issueDate?: string | null;
  sectionId: number;
  responsibleEmployeeId: number;
  status: string;
  operationText?: string | null;
  notes?: string | null;
};

export type UpdateEquipmentPayload = CreateEquipmentPayload;

export type EquipmentRegistryItem = {
  id: number;
  inventoryNumber: string;
  manufacturer: string;
  model: string;
  name: string;
  serialNumber: string | null;
  status: string;
  statusLabel: string;
  visibleId: number;
};

export type EquipmentCard = {
  commissioningDate: string | null;
  countryId: number | null;
  country: string;
  id: number;
  inventoryNumber: string;
  issueDate: string | null;
  location: string;
  manufacturerId: number | null;
  manufacturer: string;
  manufactureYear: number | null;
  model: string;
  name: string;
  notes: string | null;
  operationText: string | null;
  responsible: string;
  responsibleEmployeeId: number;
  responsiblePosition: string;
  sectionId: number;
  serialNumber: string | null;
  specifications: string | null;
  status: string;
  statusLabel: string;
  visibleId: number;
};

export type EquipmentHistoryItem = {
  action: string;
  createdAt: string;
  fieldName: string | null;
  id: number;
  newValue: string | null;
  oldValue: string | null;
  timeZone: string;
  user: string;
};

export type StorageDocumentType =
  | "passport"
  | "maintenance_instruction"
  | "equipment_photo"
  | "supporting_document";

export type EquipmentFile = {
  createdAt: string;
  deletedAt: string | null;
  displayName: string;
  documentType: StorageDocumentType;
  id: number;
  mimeType: string;
  originalName: string;
  sizeBytes: string;
};

const API_URL = import.meta.env.VITE_API_URL || "";

async function request<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    ...init,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(
      errorBody?.message ??
        "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0432\u044b\u043f\u043e\u043b\u043d\u0438\u0442\u044c \u0437\u0430\u043f\u0440\u043e\u0441.",
    );
  }

  return (await response.json()) as T;
}

export function getEquipmentCreateOptions() {
  return request<EquipmentCreateOptions>("/api/equipment/create-options");
}

export function getEquipmentRegistry() {
  return request<EquipmentRegistryItem[]>("/api/equipment");
}

export function getEquipmentCard(visibleId: number) {
  return request<EquipmentCard>(`/api/equipment/${visibleId}`);
}

export function getEquipmentHistory(visibleId: number) {
  return request<EquipmentHistoryItem[]>(`/api/equipment/${visibleId}/history`);
}

export function createEquipment(payload: CreateEquipmentPayload) {
  return request("/api/equipment", {
    body: JSON.stringify(payload),
    method: "POST",
  });
}

export function updateEquipment(
  visibleId: number,
  payload: UpdateEquipmentPayload,
) {
  return request<EquipmentCard>(`/api/equipment/${visibleId}`, {
    body: JSON.stringify(payload),
    method: "PUT",
  });
}

export function getEquipmentFiles(visibleId: number) {
  return request<EquipmentFile[]>(`/api/equipment/${visibleId}/files`);
}

export async function uploadEquipmentFile(params: {
  documentType: StorageDocumentType;
  file: File;
  visibleId: number;
}) {
  const formData = new FormData();
  formData.append("documentType", params.documentType);
  formData.append("file", params.file);

  const response = await fetch(
    `${API_URL}/api/equipment/${params.visibleId}/files`,
    {
      body: formData,
      credentials: "include",
      method: "POST",
    },
  );

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(
      errorBody?.message ??
        "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442 \u043e\u0431\u043e\u0440\u0443\u0434\u043e\u0432\u0430\u043d\u0438\u044f.",
    );
  }

  return (await response.json()) as EquipmentFile;
}

export function deleteEquipmentFile(fileId: number) {
  return request<EquipmentFile>(`/api/files/${fileId}`, {
    method: "DELETE",
  });
}

export function getEquipmentFileDownloadUrl(fileId: number) {
  return getFileDownloadUrl(fileId);
}

export async function downloadEquipmentFile(file: EquipmentFile) {
  await downloadFileById({
    fileId: file.id,
    fileName: file.displayName,
  });
}
