import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { NotificationsContext } from "./NotificationsContext";
import { NotificationViewport } from "./NotificationViewport";
import type {
  AppNotification,
  NotificationDuration,
  NotificationInput,
  NotificationType,
} from "./notifications.types";

const maxNotifications = 5;
const duplicateWindowMs = 2_500;

const defaultDurations: Record<NotificationType, number> = {
  error: 8_000,
  info: 5_000,
  success: 4_000,
  warning: 7_000,
};

type NotificationProviderProps = {
  children: ReactNode;
};

type NextNotificationsState = {
  notificationId: string;
  notifications: AppNotification[];
};

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const notificationsRef = useRef<AppNotification[]>([]);

  const dismiss = useCallback((id: string) => {
    const nextNotifications = notificationsRef.current.filter(
      (notification) => notification.id !== id,
    );

    notificationsRef.current = nextNotifications;
    setNotifications(nextNotifications);
  }, []);

  const notify = useCallback((input: NotificationInput) => {
    const nextState = createNextNotificationsState({
      createdAt: Date.now(),
      currentNotifications: notificationsRef.current,
      input,
    });

    notificationsRef.current = nextState.notifications;
    setNotifications(nextState.notifications);

    return nextState.notificationId;
  }, []);

  const contextValue = useMemo(
    () => ({
      dismiss,
      notify,
      notifyError: createTypedNotify(notify, "error"),
      notifyInfo: createTypedNotify(notify, "info"),
      notifySuccess: createTypedNotify(notify, "success"),
      notifyWarning: createTypedNotify(notify, "warning"),
    }),
    [dismiss, notify],
  );

  return (
    <NotificationsContext.Provider value={contextValue}>
      {children}
      <NotificationViewport notifications={notifications} onDismiss={dismiss} />
    </NotificationsContext.Provider>
  );
}

function createTypedNotify(
  notify: (notification: NotificationInput) => string,
  type: NotificationType,
) {
  return (title: string, message?: string, duration?: NotificationDuration) =>
    notify({
      duration,
      message,
      title,
      type,
    });
}

function createNextNotificationsState({
  createdAt,
  currentNotifications,
  input,
}: {
  createdAt: number;
  currentNotifications: AppNotification[];
  input: NotificationInput;
}): NextNotificationsState {
  const duplicate = findDuplicateNotification({
    createdAt,
    currentNotifications,
    input,
  });

  if (duplicate) {
    return {
      notificationId: duplicate.id,
      notifications: [
        {
          ...duplicate,
          createdAt,
          duration: input.duration ?? defaultDurations[input.type],
          repeatCount: duplicate.repeatCount + 1,
        },
        ...currentNotifications.filter(
          (notification) => notification.id !== duplicate.id,
        ),
      ],
    };
  }

  const notificationId = createNotificationId();

  return {
    notificationId,
    notifications: [
      {
        createdAt,
        duration: input.duration ?? defaultDurations[input.type],
        id: notificationId,
        message: input.message,
        repeatCount: 1,
        title: input.title,
        type: input.type,
      },
      ...currentNotifications,
    ].slice(0, maxNotifications),
  };
}

function findDuplicateNotification({
  createdAt,
  currentNotifications,
  input,
}: {
  createdAt: number;
  currentNotifications: AppNotification[];
  input: NotificationInput;
}) {
  const fingerprint = getNotificationFingerprint(input);

  return currentNotifications.find(
    (notification) =>
      getNotificationFingerprint(notification) === fingerprint &&
      createdAt - notification.createdAt <= duplicateWindowMs,
  );
}

function createNotificationId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getNotificationFingerprint(
  notification: Pick<NotificationInput, "message" | "title" | "type">,
) {
  return `${notification.type}\n${notification.title}\n${
    notification.message ?? ""
  }`;
}