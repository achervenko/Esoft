import { request } from "./api-client";
import { API_URL } from "./api-config";

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  occurredAt: string;
  targetPath: string | null;
  readAt: string | null;
  resolvedAt: string | null;
  requiresAction: boolean;
};

const base = "/api/notifications";

export const notificationsApi = {
  subscribe: (onChange: () => void) => {
    const stream = new EventSource(`${API_URL}${base}/stream`, {
      withCredentials: true,
    });
    stream.addEventListener("notifications-changed", onChange);
    return () => stream.close();
  },
  list: (cursor?: string, signal?: AbortSignal) =>
    request<{ items: NotificationItem[]; nextCursor: string | null }>(
      `${base}?${new URLSearchParams({ filter: "unread", ...(cursor ? { cursor } : {}) })}`,
      { signal },
    ),
  markRead: (id: string) =>
    request<{ readAt: string }>(`${base}/${id}/read`, { method: "PATCH" }),
  markAllRead: () =>
    request<{ updated: number }>(`${base}/read-all`, { method: "PATCH" }),
};
