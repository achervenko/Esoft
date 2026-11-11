import { useEffect, useState } from "react";
import {
  warehouseCatalogApi,
  type WarehouseItem,
} from "../api/warehouse-catalog-api";
import { SearchSelect } from "../ui/SearchSelect";
import { Notice } from "../ui/Notice";
import { getApiErrorMessage } from "../api/api-error";
import "./ReceiptItemPicker.css";

export function ReceiptItemPicker({
  value,
  onChange,
  focusOnMount = false,
  drafts = [],
  onCreate,
}: {
  focusOnMount?: boolean;
  drafts?: WarehouseItem[];
  onCreate?: (search: string) => void;
  value: WarehouseItem | null;
  onChange: (item: WarehouseItem | null) => void;
}) {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<WarehouseItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [completedSearch, setCompletedSearch] = useState<string | null>(null);
  useEffect(() => {
    const c = new AbortController();
    setError(null);
    setItems([]);
    const timer = setTimeout(() => {
      warehouseCatalogApi
        .list(
          new URLSearchParams({
            q: search,
            limit: "50",
            offset: "0",
            isActive: "true",
          }),
          c.signal,
        )
        .then((result) => {
          if (!c.signal.aborted) {
            setItems(result.items);
            setCompletedSearch(search);
          }
        })
        .catch((e) => {
          if (!c.signal.aborted) setError(getApiErrorMessage(e));
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [search]);
  const needle = search.trim().toLocaleLowerCase();
  const available = [
    ...drafts.filter((item) =>
      `${item.article} ${item.name}`.toLocaleLowerCase().includes(needle),
    ),
    ...items,
  ];
  const options =
    value && !available.some((i) => i.id === value.id)
      ? [value, ...available]
      : available;
  return (
    <>
      <SearchSelect
        label="Номенклатура"
        focusOnMount={focusOnMount}
        value={value ? options.findIndex((i) => i.id === value.id) : null}
        onSearchChange={(next) => {
          setCompletedSearch(null);
          setSearch(next);
        }}
        onChange={(index) =>
          onChange(index === null ? null : (options[index] ?? null))
        }
        options={options.map((item, index) => ({
          id: index,
          name: `${item.article} — ${item.name}`,
        }))}
        filterOption={() => true}
        maxResults={51}
        emptyMessage="Номенклатура не найдена. Уточните артикул или название."
      />
      {onCreate &&
        needle &&
        !value &&
        completedSearch === search &&
        !error &&
        !available.length && (
          <button
            type="button"
            className="admin-secondary-button receipt-item-create"
            onClick={() => onCreate(search)}
          >
            Создать номенклатуру
          </button>
        )}
      {error && <Notice tone="error">{error}</Notice>}
    </>
  );
}
