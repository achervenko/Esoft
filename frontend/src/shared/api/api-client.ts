import { ApiRequestError } from "./api-error";
import { API_URL } from "./api-config";
import { emitSessionExpired } from "./session-expired";

type ApiRequestInit = RequestInit & {
  handleUnauthorized?: boolean;
};

export async function request<T>(path: string, init: ApiRequestInit = {}) {
  const { handleUnauthorized = true, ...requestInit } = init;
  const headers = new Headers(requestInit.headers);

  if (typeof requestInit.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...requestInit,
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    if (response.status === 401 && handleUnauthorized) {
      emitSessionExpired();
    }

    const errorBody = await readJsonResponse(response).catch(() => null);
    throw new ApiRequestError(
      errorBody?.message ?? "Не удалось выполнить запрос.",
      response.status,
      errorBody?.code,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const responseText = await response.text();

  if (!responseText) {
    return undefined as T;
  }

  try {
    return JSON.parse(responseText) as T;
  } catch {
    throw new ApiRequestError(
      "Сервер вернул некорректный ответ.",
      response.status,
    );
  }
}

async function readJsonResponse(response: Response) {
  const responseText = await response.text();

  if (!responseText) {
    return null;
  }

  return JSON.parse(responseText) as { code?: string; message?: string };
}
