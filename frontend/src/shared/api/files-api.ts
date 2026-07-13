const API_URL = import.meta.env.VITE_API_URL || "";

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
    const errorBody = await response.json().catch(() => null);
    throw new Error(
      errorBody?.message ??
        "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0442\u043a\u0440\u044b\u0442\u044c PDF.",
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
    const errorBody = await response.json().catch(() => null);
    throw new Error(
      errorBody?.message ??
        "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043a\u0430\u0447\u0430\u0442\u044c \u0444\u0430\u0439\u043b.",
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
