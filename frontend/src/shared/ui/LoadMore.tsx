import { useEffect, useRef } from "react";
import { Notice } from "./Notice";
import "./AdminButtons.css";
import "./LoadMore.css";

export function LoadMore({
  shown,
  total,
  loading,
  error,
  hasMore,
  disabled = false,
  onLoadMore,
  onRetry,
}: {
  shown: number;
  total: number;
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  disabled?: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (
      !hasMore ||
      loading ||
      error ||
      disabled ||
      !sentinel.current ||
      typeof IntersectionObserver === "undefined"
    )
      return;
    let active = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (active && entry.isIntersecting) {
          active = false;
          observer.disconnect();
          onLoadMore();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinel.current);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [shown, hasMore, loading, error, disabled, onLoadMore]);
  return (
    <div className="load-more">
      <p className="load-more-count">
        Показано {shown} из {total}
      </p>
      {loading ? (
        <p role="status">Загрузка…</p>
      ) : error ? (
        <Notice tone="error">
          {error}
          <button
            type="button"
            className="admin-secondary-button"
            disabled={disabled}
            onClick={onRetry}
          >
            Повторить загрузку
          </button>
        </Notice>
      ) : hasMore ? (
        <button
          type="button"
          className="admin-secondary-button"
          disabled={disabled}
          onClick={onLoadMore}
        >
          Показать ещё
        </button>
      ) : null}
      <div ref={sentinel} className="load-more-sentinel" aria-hidden="true" />
    </div>
  );
}
