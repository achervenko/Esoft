import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { LoadMore } from "./LoadMore";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("loads once per intersection and ignores disconnected observers", () => {
  const callbacks: IntersectionObserverCallback[] = [];
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        callbacks.push(callback);
      }
      observe() {}
      disconnect() {}
    },
  );
  const onLoadMore = vi.fn();
  const props = {
    shown: 50,
    total: 101,
    loading: false,
    error: null,
    hasMore: true,
    onLoadMore,
    onRetry: vi.fn(),
  };
  const { rerender } = render(<LoadMore {...props} />);
  const intersect = () =>
    callbacks[0](
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
  act(() => {
    intersect();
    intersect();
  });
  expect(onLoadMore).toHaveBeenCalledTimes(1);
  rerender(<LoadMore {...props} loading />);
  act(intersect);
  expect(onLoadMore).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("status")).toHaveTextContent("Загрузка");
});
it("provides a manual fallback and retries instead of auto-loading errors", () => {
  const onLoadMore = vi.fn(),
    onRetry = vi.fn();
  const props = {
    shown: 50,
    total: 101,
    loading: false,
    error: null,
    hasMore: true,
    onLoadMore,
    onRetry,
  };
  const { rerender } = render(<LoadMore {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Показать ещё" }));
  expect(onLoadMore).toHaveBeenCalledOnce();
  rerender(<LoadMore {...props} error="Нет сети" />);
  expect(screen.getByText("Показано 50 из 101")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Показать ещё" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Повторить загрузку" }));
  expect(onRetry).toHaveBeenCalledOnce();
});
