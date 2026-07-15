import { ApiRequestError } from "./api-error";

export const API_URL = import.meta.env.VITE_API_URL || "";

export async function request<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);

  if (typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });

  if (!response.ok) {
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

  return JSON.parse(responseText) as T;
}

async function readJsonResponse(response: Response) {
  const responseText = await response.text();

  if (!responseText) {
    return null;
  }

  return JSON.parse(responseText) as { code?: string; message?: string };
}
