import { useEffect, useState } from "react";
import { ordersApi, type OrderData } from "../../shared/api/orders-api";
import { getApiErrorMessage } from "../../shared/api/api-error";
import { SearchSelect } from "../../shared/ui/SearchSelect";

export function ReservationOrderPicker({
  value,
  onChange,
}: {
  value: OrderData | null;
  onChange: (order: OrderData | null) => void;
}) {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<OrderData[]>([]);
  const [error, setError] = useState<string>();
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      ordersApi
        .list(
          new URLSearchParams({
            search: search.trim().slice(0, 255),
            closed: "false",
            missing: "false",
            limit: "50",
          }),
          controller.signal,
        )
        .then(({ items }) => {
          if (!controller.signal.aborted) setItems(items);
        })
        .catch((cause) => {
          if (!controller.signal.aborted) setError(getApiErrorMessage(cause));
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search]);
  const options =
    value && !items.some((item) => item.id === value.id)
      ? [value, ...items]
      : items;
  return (
    <SearchSelect
      label="Заказ"
      required
      error={error}
      value={value ? options.findIndex((item) => item.id === value.id) : null}
      onChange={(index) =>
        onChange(index === null ? null : (options[index] ?? null))
      }
      onSearchChange={(query) => {
        if (query === search) return;
        setItems([]);
        setError(undefined);
        setSearch(query);
      }}
      options={options.map((item, index) => ({
        id: index,
        name: item.name.trim() ? `${item.number} — ${item.name}` : item.number,
      }))}
      filterOption={() => true}
      emptyMessage="Заказы не найдены. Уточните номер или название."
    />
  );
}
