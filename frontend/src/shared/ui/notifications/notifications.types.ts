export type NotificationType = "error" | "info" | "success" | "warning";

export type NotificationDuration = number | false;

export type NotificationInput = {
  duration?: NotificationDuration;
  message?: string;
  title: string;
  type: NotificationType;
};

export type AppNotification = Required<
  Pick<NotificationInput, "title" | "type">
> & {
  createdAt: number;
  duration: NotificationDuration;
  id: string;
  message?: string;
  repeatCount: number;
};

export type NotificationsContextValue = {
  dismiss: (id: string) => void;
  notify: (notification: NotificationInput) => string;
  notifyError: (title: string, message?: string, duration?: NotificationDuration) => string;
  notifyInfo: (title: string, message?: string, duration?: NotificationDuration) => string;
  notifySuccess: (title: string, message?: string, duration?: NotificationDuration) => string;
  notifyWarning: (title: string, message?: string, duration?: NotificationDuration) => string;
};
