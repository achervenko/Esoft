import "./WarehouseItemPhoto.css";
import { Image } from "lucide-react";
import { AsyncImage } from "../ui/AsyncImage";
import type { StockItem } from "../api/warehouse-stock-api";
export function WarehouseItemPhoto({
  item,
}: {
  item: Pick<StockItem, "name" | "photo">;
}) {
  return (
    <span className="stock-photo">
      {item.photo ? (
        <AsyncImage src={item.photo} alt={item.name} />
      ) : (
        <Image size={24} aria-label="Нет фотографии" />
      )}
    </span>
  );
}
