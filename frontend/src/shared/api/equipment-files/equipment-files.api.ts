import { API_URL, request } from "../api-client";
import { ApiRequestError } from "../api-error";
import { downloadFileById, getFileDownloadUrl } from "../files-api";
import type {
  EquipmentFile,
  StorageDocumentType,
} from "./equipment-files.types";

const UPLOAD_TIMEOUT_MS = 120_000;

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

  const abortController = new AbortController();
  const timeoutId = window.setTimeout(
    () => abortController.abort(),
    UPLOAD_TIMEOUT_MS,
  );
  const response = await fetch(
    `${API_URL}/api/equipment/${params.visibleId}/files`,
    {
      body: formData,
      credentials: "include",
      method: "POST",
      signal: abortController.signal,
    },
  ).finally(() => window.clearTimeout(timeoutId));

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new ApiRequestError(
      errorBody?.message ??
        "Не удалось загрузить документ оборудования.",
      response.status,
      errorBody?.code,
    );
  }

  return (await response.json()) as EquipmentFile;
}

export function deleteEquipmentFile(fileId: number) {
  return request<EquipmentFile>(`/api/files/${fileId}`, {
    method: "DELETE",
  });
}

export function setEquipmentFilePrimary(fileId: number) {
  return request<EquipmentFile>(`/api/files/${fileId}/primary`, {
    method: "PATCH",
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
