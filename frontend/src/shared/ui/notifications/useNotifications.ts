import { useContext } from "react";
import { NotificationsContext } from "./NotificationsContext";

export function useNotifications() {
  const notifications = useContext(NotificationsContext);

  if (!notifications) {
    throw new Error("useNotifications must be used inside NotificationProvider.");
  }

  return notifications;
}
