import "../../shared/ui/AdminPage.css";
import "./NotificationsFeed.css";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { MessageSquareCheck } from "lucide-react";
import {
  notificationsApi,
  type NotificationItem,
} from "../../shared/api/notifications-api";
import { getApiErrorMessage } from "../../shared/api/api-error";
import { ContextMenu } from "../../shared/ui/ContextMenu";
import { NotificationCard } from "./NotificationCard";
import { Notice } from "../../shared/ui/Notice";
import { LoadingIndicator } from "../../shared/ui/LoadingIndicator";
import { LoadMore } from "../../shared/ui/LoadMore";
import { useWindowedGrid } from "../../shared/lib/useWindowedGrid";
import { canAccessWorkspaceRoute } from "../../lib/role-navigation";
import { normalizeHashRoute } from "../../lib/hash-router";
import { buildHashRoute } from "../../shared/lib/hash-navigation";

export function NotificationsFeed({
  permissions,
}: {
  permissions: readonly string[] | null;
}) {
  const [items, setItems] = useState<
    (NotificationItem & { entering?: boolean })[]
  >([]);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(
    null,
  );
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadedPages = useRef(1);
  const grid = useWindowedGrid<HTMLUListElement>(items.length);

  useEffect(() => {
    const controller = new AbortController();
    const pageCount = loadedPages.current;
    const reload = async () => {
      const refreshed = new Map<string, NotificationItem>();
      let cursor: string | null = null;
      for (let index = 0; index < pageCount; index++) {
        const page = await notificationsApi.list(
          cursor ?? undefined,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        for (const item of page.items) refreshed.set(item.id, item);
        cursor = page.nextCursor;
        if (!cursor) break;
      }
      const rows = [...refreshed.values()];
      setItems((current) => {
        if (revision === 0) return rows;
        const existingIds = new Set(current.map((item) => item.id));
        return rows.map((item) => ({
          ...item,
          entering: !existingIds.has(item.id),
        }));
      });
      setNextCursor(cursor);
    };
    void reload()
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) setError(getApiErrorMessage(failure));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [revision]);

  const refresh = () => {
    setError(null);
    setPageError(null);
    setLoading(true);
    setRevision((value) => value + 1);
  };
  const perform = async (operation: () => Promise<void>) => {
    setWorking(true);
    setError(null);
    try {
      await operation();
    } catch (failure) {
      setError(getApiErrorMessage(failure));
    } finally {
      setWorking(false);
    }
  };
  const busy = loading || working || loadingMore;
  const loadMore = async () => {
    if (busy || !nextCursor) return;
    setLoadingMore(true);
    setPageError(null);
    try {
      const page = await notificationsApi.list(nextCursor);
      loadedPages.current += 1;
      setItems((rows) => {
        const existingIds = new Set(rows.map((item) => item.id));
        return [
          ...rows,
          ...page.items.filter((item) => !existingIds.has(item.id)),
        ];
      });
      setNextCursor(page.nextCursor);
    } catch (failure) {
      setPageError(getApiErrorMessage(failure));
    } finally {
      setLoadingMore(false);
    }
  };
  const refreshPending = useRef(false);
  const onFeedChanged = useEffectEvent(() => {
    if (busy) refreshPending.current = true;
    else refresh();
  });
  useEffect(() => {
    const onFocus = () => onFeedChanged();
    window.addEventListener("focus", onFocus);
    const unsubscribe =
      typeof EventSource === "undefined"
        ? undefined
        : notificationsApi.subscribe(() => onFeedChanged());
    return () => {
      window.removeEventListener("focus", onFocus);
      unsubscribe?.();
    };
  }, []);
  useEffect(() => {
    if (busy) return;
    if (refreshPending.current) {
      refreshPending.current = false;
      onFeedChanged();
    }
  }, [busy]);

  return (
    <section className="admin-card notifications-feed" aria-label="Уведомления">
      {items.length > 0 && (
        <button
          type="button"
          className="admin-secondary-button admin-icon-button notifications-feed-mark-all"
          aria-label="Отметить все прочитанными"
          title="Отметить все прочитанными"
          disabled={busy}
          onClick={() =>
            void perform(async () => {
              await notificationsApi.markAllRead();
              refresh();
            })
          }
        >
          <MessageSquareCheck size={18} aria-hidden="true" />
        </button>
      )}
      <div className="notifications-feed-loading">
        <LoadingIndicator loading={loading && revision === 0} />
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {!busy && !error && !items.length && <p>Уведомлений пока нет.</p>}
      {items.length > 0 && (
        <ul className="notifications-feed-list" ref={grid.gridRef}>
          {grid.before > 0 && (
            <li aria-hidden="true" style={{ height: grid.before }} />
          )}
          {items.slice(grid.start, grid.end).map((item, index) => {
            const target = item.targetPath
              ? normalizeHashRoute(item.targetPath)
              : null;
            return (
              <NotificationCard
                key={item.id}
                item={item}
                index={grid.start + index}
                entering={item.entering}
                href={
                  target && canAccessWorkspaceRoute(permissions, target)
                    ? buildHashRoute(target, { returnTo: "#/dashboard" })
                    : null
                }
                onMenu={(x, y) => setMenu({ id: item.id, x, y })}
              />
            );
          })}
          {grid.after > 0 && (
            <li aria-hidden="true" style={{ height: grid.after }} />
          )}
        </ul>
      )}
      {menu && items.some((item) => item.id === menu.id) && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          label="Действия с уведомлением"
          className="notifications-feed-context-menu"
          onClose={() => setMenu(null)}
          items={[
            {
              id: "read",
              label: "Отметить как прочитанное",
              icon: <MessageSquareCheck size={16} aria-hidden="true" />,
              disabled: busy,
              onSelect: () =>
                void perform(async () => {
                  await notificationsApi.markRead(menu.id);
                  setItems((rows) => rows.filter((row) => row.id !== menu.id));
                  refresh();
                }),
            },
          ]}
        />
      )}
      {nextCursor && (
        <LoadMore
          shown={items.length}
          total={items.length}
          hasMore
          loading={loadingMore}
          error={pageError}
          disabled={busy || Boolean(error)}
          onLoadMore={() => void loadMore()}
          onRetry={() => void loadMore()}
          showCount={false}
          showButton={false}
        />
      )}
    </section>
  );
}
