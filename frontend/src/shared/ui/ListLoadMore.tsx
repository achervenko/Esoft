import { LoadMore } from "./LoadMore";

export type IncrementalListControls = {
  data: { items: readonly unknown[]; total: number; limit: number } | null;
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  retry: () => void;
};

export function ListLoadMore({
  list,
  disabled = false,
}: {
  list: IncrementalListControls;
  disabled?: boolean;
}) {
  if (
    !list.data ||
    (list.data.total <= list.data.limit && !list.error && !list.loading)
  )
    return null;
  return (
    <LoadMore
      shown={list.data.items.length}
      total={list.data.total}
      loading={list.loading}
      error={list.error}
      hasMore={list.hasMore}
      disabled={disabled}
      onLoadMore={list.loadMore}
      onRetry={list.retry}
    />
  );
}
