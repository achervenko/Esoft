import { request } from "../api-client";
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
  try {
    return await request<EquipmentFile>(
      `/api/equipment/${params.visibleId}/files`,
      {
        body: formData,
        method: "POST",
        signal: abortController.signal,
      },
    );
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function deleteEquipmentFile(params: {
  fileId: number;
  visibleId: number;
}) {
  return request<EquipmentFile>(
    `/api/equipment/${params.visibleId}/files/${params.fileId}`,
    {
      method: "DELETE",
    },
  );
}

export function setEquipmentFilePrimary(params: {
  fileId: number;
  visibleId: number;
}) {
  return request<EquipmentFile>(
    `/api/equipment/${params.visibleId}/files/${params.fileId}/primary`,
    {
      method: "PATCH",
    },
  );
}

export function getEquipmentFileDownloadUrl(params: {
  fileId: number;
  visibleId: number;
}) {
  return getFileDownloadUrl(params);
}

export async function downloadEquipmentFile(params: {
  file: EquipmentFile;
  visibleId: number;
}) {
  await downloadFileById({
    fileId: params.file.id,
    fileName: params.file.displayName,
    visibleId: params.visibleId,
  });
}
