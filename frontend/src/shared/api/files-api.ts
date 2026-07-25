import { ApiRequestError } from "./api-error";
import { API_URL } from "./api-config";

export type FilePreviewSize = "small" | "medium";

export function getFilePreviewUrl(
  fileId: number,
  options: { size?: FilePreviewSize } = {},
) {
  const baseUrl = `${API_URL}/api/files/${fileId}/preview`;
  return options.size ? `${baseUrl}?size=${options.size}` : baseUrl;
}

export function getFileDownloadUrl(fileId: number) {
  return `${API_URL}/api/files/${fileId}/download`;
}

export async function fetchPdfPreviewBlob(fileId: number) {
  const response = await fetch(getFilePreviewUrl(fileId), {
    credentials: "include",
  });

  if (!response.ok) {
    const errorBody = await readFileErrorResponse(response);
    throw new ApiRequestError(
      errorBody?.message ?? "Не удалось открыть PDF.",
      response.status,
      errorBody?.code,
    );
  }

  return response.blob();
}

export async function downloadFileById(params: {
  fileId: number;
  fileName: string;
}) {
  const response = await fetch(getFileDownloadUrl(params.fileId), {
    credentials: "include",
  });

  if (!response.ok) {
    const errorBody = await readFileErrorResponse(response);
    throw new ApiRequestError(
      errorBody?.message ?? "Не удалось скачать файл.",
      response.status,
      errorBody?.code,
    );
  }

  const blob = await response.blob();
  const fileName =
    getFileNameFromContentDisposition(
      response.headers.get("Content-Disposition"),
    ) || params.fileName;
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

function getFileNameFromContentDisposition(value: string | null) {
  if (!value) {
    return null;
  }

  const encodedFileName = value.match(/filename\*=UTF-8''([^;]+)/i)?.[1];

  if (encodedFileName) {
    return decodeURIComponent(encodedFileName);
  }

  return value.match(/filename="([^"]+)"/i)?.[1] ?? null;
}

async function readFileErrorResponse(response: Response) {
  return response.json().catch(() => null) as Promise<{
    code?: string;
    message?: string;
  } | null>;
}
