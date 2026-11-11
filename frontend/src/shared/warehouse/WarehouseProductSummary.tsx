import "./WarehouseProductSummary.css";
import type { StockItem } from "../api/warehouse-stock-api";
import { formatStockQuantity } from "../lib/warehouse-quantity";
import { WarehouseItemPhoto } from "./WarehouseItemPhoto";
import { WarehouseItemIdentity } from "./WarehouseItemIdentity";

export function WarehouseProductSummary({
  item,
  quantity,
  quantityLabel,
}: {
  item: Pick<StockItem, "name" | "article" | "photo" | "unit">;
  quantity: string;
  quantityLabel: string;
}) {
  return (
    <div className="stock-transfer-product">
      <WarehouseItemPhoto item={item} />
      <WarehouseItemIdentity name={item.name} article={item.article} />
      <div className="stock-transfer-total">
        <span>{quantityLabel}</span>
        <strong>
          {formatStockQuantity(quantity)} {item.unit}
        </strong>
      </div>
    </div>
  );
}
