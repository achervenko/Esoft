import { useEffect, useRef } from "react";
import {
  formatBusinessDateTime,
  getBusinessDateString,
  getBusinessTodayDateString,
} from "../../shared/lib/business-date";
import type { NotificationItem } from "../../shared/api/notifications-api";

export function NotificationCard({
  item,
  entering,
  index,
  href,
  onMenu,
}: {
  item: NotificationItem;
  entering?: boolean;
  index?: number;
  href: string | null;
  onMenu: (x: number, y: number) => void;
}) {
  const press = useRef<{
    id: number;
    x: number;
    y: number;
    timer: number;
  } | null>(null);
  const suppressClick = useRef(false);

  const cancelPress = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
  };
  useEffect(
    () => () => {
      if (press.current) window.clearTimeout(press.current.timer);
    },
    [],
  );

  const Card = href ? "a" : "button";
  const arrival = item.type === "warehouse.receipt.created";
  const body = arrival
    ? item.body.replace(/\. Требуется разместить товар на складе\.$/, "")
    : item.type === "warehouse.receipt.conflict"
      ? item.body.replace(/требует решения\.$/, "требует решения")
      : item.body;
  const today = getBusinessTodayDateString();
  const day = getBusinessDateString(new Date(item.occurredAt));
  const yesterday = new Date(Date.parse(today) - 86_400_000)
    .toISOString()
    .slice(0, 10);
  const timestamp =
    day === today
      ? formatBusinessDateTime(item.occurredAt, { timeStyle: "short" })
      : day === yesterday
        ? "Вчера"
        : formatBusinessDateTime(item.occurredAt, { dateStyle: "short" });
  return (
    <li
      className={entering ? "notifications-feed-entering" : undefined}
      data-grid-index={index}
    >
      <div className="notifications-feed-slot">
        <Card
          className="notifications-feed-card"
          href={href ?? undefined}
          type={href ? undefined : "button"}
          aria-haspopup="menu"
          onContextMenu={(event) => {
            event.preventDefault();
            if (press.current) suppressClick.current = true;
            cancelPress();
            const bounds = event.currentTarget.getBoundingClientRect();
            onMenu(
              event.clientX || bounds.left,
              event.clientY || bounds.bottom,
            );
          }}
          onKeyDown={(event) => {
            if (
              event.key !== "ContextMenu" &&
              !(event.shiftKey && event.key === "F10")
            )
              return;
            event.preventDefault();
            const bounds = event.currentTarget.getBoundingClientRect();
            onMenu(bounds.left, bounds.bottom);
          }}
          onPointerDown={(event) => {
            cancelPress();
            suppressClick.current = false;
            if (event.pointerType !== "touch" || !event.isPrimary) return;
            const { clientX: x, clientY: y, pointerId: id } = event;
            press.current = {
              id,
              x,
              y,
              timer: window.setTimeout(() => {
                suppressClick.current = true;
                onMenu(x, y);
              }, 520),
            };
          }}
          onPointerMove={(event) => {
            const start = press.current;
            if (
              start?.id === event.pointerId &&
              Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8
            )
              cancelPress();
          }}
          onPointerUp={cancelPress}
          onPointerCancel={cancelPress}
          onClick={(event) => {
            if (suppressClick.current) {
              suppressClick.current = false;
              event.preventDefault();
            } else if (!href) {
              const bounds = event.currentTarget.getBoundingClientRect();
              onMenu(bounds.left, bounds.bottom);
            }
          }}
        >
          <span className="notifications-feed-card-content">
            <span>{body}</span>
          </span>
          <time
            dateTime={item.occurredAt}
            title={formatBusinessDateTime(item.occurredAt)}
          >
            {timestamp}
          </time>
        </Card>
      </div>
    </li>
  );
}
