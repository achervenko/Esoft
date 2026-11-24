import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { notificationsApi } from "../../shared/api/notifications-api";
import { NotificationsFeed } from "./NotificationsFeed";
import { NotificationCard } from "./NotificationCard";

vi.mock("../../shared/api/notifications-api", () => ({
  notificationsApi: {
    subscribe: vi.fn(),
    list: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
  },
}));

afterEach(cleanup);

it.each(["SSE", "focus"])(
  "keeps expanded pages on %s refresh",
  async (source) => {
    vi.stubGlobal("EventSource", vi.fn());
    const observe = vi.fn();
    let onIntersection: IntersectionObserverCallback;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: IntersectionObserverCallback) {
          onIntersection = callback;
        }
        observe = observe;
        disconnect = vi.fn();
      },
    );
    const reachEnd = () =>
      act(() =>
        onIntersection(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          {} as IntersectionObserver,
        ),
      );
    try {
      const notice = (id: string) => ({
        id,
        type: "test",
        title: "Тест",
        body: id,
        occurredAt: "2026-11-23T08:00:00Z",
        targetPath: null,
        readAt: null,
        resolvedAt: null,
        requiresAction: false,
      });
      const list = vi.mocked(notificationsApi.list);
      list
        .mockResolvedValueOnce({
          items: [notice("Закрытое")],
          nextCursor: "old-1",
        })
        .mockResolvedValueOnce({
          items: [notice("Нижнее")],
          nextCursor: "old-2",
        })
        .mockResolvedValueOnce({
          items: [notice("Новое"), notice("На границе")],
          nextCursor: "new-1",
        })
        .mockResolvedValueOnce({
          items: [notice("На границе"), notice("Нижнее")],
          nextCursor: "new-2",
        })
        .mockResolvedValueOnce({
          items: [notice("Следующее")],
          nextCursor: null,
        });

      render(<NotificationsFeed permissions={["notifications.read"]} />);
      await waitFor(() => expect(observe).toHaveBeenCalled());
      expect(screen.queryByRole("button", { name: "Показать ещё" })).toBeNull();
      reachEnd();
      expect(await screen.findByText("Нижнее")).toBeVisible();

      act(() => {
        if (source === "SSE")
          vi.mocked(notificationsApi.subscribe).mock.lastCall![0]();
        else window.dispatchEvent(new Event("focus"));
      });
      expect(await screen.findByText("Новое")).toBeVisible();
      expect(screen.getByText("Нижнее")).toBeVisible();
      expect(screen.getAllByText("На границе")).toHaveLength(1);
      expect(screen.queryByText("Закрытое")).not.toBeInTheDocument();
      expect(list).toHaveBeenLastCalledWith("new-1", expect.any(AbortSignal));

      reachEnd();
      expect(await screen.findByText("Следующее")).toBeVisible();
      expect(list).toHaveBeenLastCalledWith("new-2");
    } finally {
      vi.unstubAllGlobals();
    }
  },
);

it("refreshes the feed on a stream signal and closes the subscription on unmount", async () => {
  vi.stubGlobal("EventSource", vi.fn());
  try {
    const unsubscribe = vi.fn();
    vi.mocked(notificationsApi.subscribe).mockReturnValue(unsubscribe);
    vi.mocked(notificationsApi.list)
      .mockResolvedValueOnce({ items: [], nextCursor: null })
      .mockResolvedValueOnce({
        items: [
          {
            id: "from-sse",
            type: "test",
            title: "Тест",
            body: "Пришло новое уведомление",
            occurredAt: "2026-11-23T08:00:00Z",
            targetPath: null,
            readAt: null,
            resolvedAt: null,
            requiresAction: false,
          },
        ],
        nextCursor: null,
      });
    const { unmount } = render(
      <NotificationsFeed permissions={["notifications.read"]} />,
    );
    expect(await screen.findByText("Уведомлений пока нет.")).toBeVisible();
    const [onChange] = vi.mocked(notificationsApi.subscribe).mock.lastCall!;
    act(() => onChange());
    const card = await screen.findByText("Пришло новое уведомление");
    expect(card.closest("li")).toHaveClass("notifications-feed-entering");
    unmount();
    expect(unsubscribe).toHaveBeenCalledOnce();
  } finally {
    vi.unstubAllGlobals();
  }
});

it("opens the menu on a long tap and suppresses the following navigation", () => {
  vi.useFakeTimers();
  try {
    const onMenu = vi.fn();
    const item = {
      id: "notice-touch",
      type: "warehouse.receipt.created",
      title: "Новый приход",
      body: "Получен приход №125. Требуется разместить товар на складе.",
      occurredAt: "2026-11-23T08:00:00Z",
      readAt: null,
      resolvedAt: null,
      requiresAction: true,
      targetPath: "#/warehouse/receipts/671",
    };
    render(
      <ul>
        <NotificationCard item={item} href={item.targetPath} onMenu={onMenu} />
      </ul>,
    );
    const card = screen.getByRole("link");
    const pointerDown = () =>
      fireEvent(
        card,
        Object.assign(new Event("pointerdown", { bubbles: true }), {
          pointerType: "touch",
          isPrimary: true,
          pointerId: 1,
          clientX: 25,
          clientY: 30,
        }),
      );
    pointerDown();
    fireEvent.pointerCancel(card);
    act(() => vi.advanceTimersByTime(520));
    expect(onMenu).not.toHaveBeenCalled();
    pointerDown();
    act(() => vi.advanceTimersByTime(520));
    expect(onMenu).toHaveBeenCalledWith(25, 30);
    fireEvent.pointerUp(card);
    expect(fireEvent.click(card)).toBe(false);
  } finally {
    vi.useRealTimers();
  }
});

it("shows a personal receipt notification and marks it read explicitly", async () => {
  vi.mocked(notificationsApi.list)
    .mockResolvedValueOnce({
      items: [
        {
          id: "notice-1",
          type: "warehouse.receipt.created",
          title: "Новый приход из 1С",
          body: "Получен приход №125. Требуется разместить товар на складе.",
          occurredAt: "2026-11-23T08:00:00Z",
          readAt: null,
          resolvedAt: null,
          requiresAction: true,
          targetPath: "/warehouse/receipts/671",
        },
      ],
      nextCursor: null,
    })
    .mockResolvedValue({ items: [], nextCursor: null });
  vi.mocked(notificationsApi.markRead).mockResolvedValue({
    readAt: "2026-11-23T08:01:00Z",
  });

  render(
    <NotificationsFeed
      permissions={["notifications.read", "warehouse.receipts.read"]}
    />,
  );

  const item = within(await screen.findByRole("listitem"));
  expect(
    item.getByRole("link", { name: /Получен приход №125/ }),
  ).toHaveAttribute(
    "href",
    "#/warehouse/receipts/671?returnTo=%23%2Fdashboard",
  );
  expect(notificationsApi.markRead).not.toHaveBeenCalled();
  fireEvent.contextMenu(item.getByRole("link"));
  fireEvent.click(
    screen.getByRole("menuitem", { name: "Отметить как прочитанное" }),
  );
  expect(await screen.findByText("Уведомлений пока нет.")).toBeVisible();
  expect(notificationsApi.markRead).toHaveBeenCalledWith("notice-1");

  expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
});

it("hides the document link without receipt permission", async () => {
  vi.mocked(notificationsApi.list).mockResolvedValue({
    items: [
      {
        id: "closed",
        type: "warehouse.receipt.created",
        title: "Новый приход из 1С",
        body: "Получен приход №125. Требуется разместить товар на складе.",
        occurredAt: "2026-11-23T08:00:00Z",
        readAt: null,
        resolvedAt: null,
        requiresAction: true,
        targetPath: "#/warehouse/receipts/671",
      },
    ],
    nextCursor: null,
  });
  render(<NotificationsFeed permissions={["notifications.read"]} />);
  expect(await screen.findByText("Получен приход №125")).toBeVisible();
  expect(
    screen.queryByRole("link", { name: /Получен приход №125/ }),
  ).not.toBeInTheDocument();
});
