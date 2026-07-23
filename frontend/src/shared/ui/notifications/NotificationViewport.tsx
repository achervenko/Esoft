import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppNotification } from "./notifications.types";

type NotificationViewportProps = {
  notifications: AppNotification[];
  onDismiss: (id: string) => void;
};

type NotificationCardProps = {
  notification: AppNotification;
  onDismiss: (id: string) => void;
};

const animationMs = 240;

const icons = {
  error: AlertCircle,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
};

const labels = {
  error: "Ошибка",
  info: "Информация",
  success: "Успех",
  warning: "Предупреждение",
};

export function NotificationViewport({
  notifications,
  onDismiss,
}: NotificationViewportProps) {
  return (
    <div
      aria-label="Уведомления"
      aria-live="polite"
      className="notification-viewport"
    >
      {notifications.map((notification) => (
        <NotificationCard
          key={notification.id}
          notification={notification}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
}

function NotificationCard({ notification, onDismiss }: NotificationCardProps) {
  const [isClosing, setIsClosing] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const remainingMsRef = useRef(
    notification.duration === false ? 0 : notification.duration,
  );
  const startedAtRef = useRef<number | null>(null);
  const Icon = icons[notification.type];

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const dismissWithAnimation = useCallback(() => {
    clearCloseTimer();
    setIsClosing(true);
    window.setTimeout(() => onDismiss(notification.id), animationMs);
  }, [clearCloseTimer, notification.id, onDismiss]);

  const pauseAutoDismiss = useCallback(() => {
    if (notification.duration === false || startedAtRef.current === null) {
      return;
    }

    clearCloseTimer();
    remainingMsRef.current = Math.max(
      0,
      remainingMsRef.current - (Date.now() - startedAtRef.current),
    );
    startedAtRef.current = null;
  }, [clearCloseTimer, notification.duration]);

  useEffect(() => {
    remainingMsRef.current =
      notification.duration === false ? 0 : notification.duration;

    if (notification.duration !== false && remainingMsRef.current > 0) {
      clearCloseTimer();
      startedAtRef.current = Date.now();
      closeTimerRef.current = window.setTimeout(
        dismissWithAnimation,
        remainingMsRef.current,
      );
    }

    return clearCloseTimer;
  }, [
    clearCloseTimer,
    dismissWithAnimation,
    notification.duration,
    notification.id,
    notification.repeatCount,
  ]);

  const resumeAutoDismiss = useCallback(() => {
    if (notification.duration === false || remainingMsRef.current <= 0) {
      return;
    }

    clearCloseTimer();
    startedAtRef.current = Date.now();
    closeTimerRef.current = window.setTimeout(
      dismissWithAnimation,
      remainingMsRef.current,
    );
  }, [clearCloseTimer, dismissWithAnimation, notification.duration]);

  return (
    <article
      className={`notification-card notification-card-${notification.type}${
        isClosing ? " closing" : ""
      }`}
      onMouseEnter={pauseAutoDismiss}
      onMouseLeave={resumeAutoDismiss}
      role={notification.type === "error" ? "alert" : "status"}
    >
      <span className="notification-icon" aria-hidden="true">
        <Icon size={19} />
      </span>
      <div className="notification-content">
        <div className="notification-title-row">
          <strong>{notification.title}</strong>
          {notification.repeatCount > 1 ? (
            <span className="notification-repeat">
              x{notification.repeatCount}
            </span>
          ) : null}
        </div>
        {notification.message ? <p>{notification.message}</p> : null}
      </div>
      <button
        aria-label={`Закрыть уведомление: ${labels[notification.type]}`}
        className="notification-close"
        onClick={dismissWithAnimation}
        type="button"
      >
        <X size={16} />
      </button>
    </article>
  );
}
