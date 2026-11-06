import { MapPin } from "lucide-react";
import { formatStockQuantity } from "./stock-page.utils";
export function StockLocationSummary({
  name,
  quantity,
  unit,
}: {
  name: string;
  quantity: string;
  unit: string;
}) {
  return (
    <div className="stock-adjust-location">
      <span>
        <MapPin size={18} aria-hidden="true" />
        <span title={name}>{name}</span>
      </span>
      <strong>
        {formatStockQuantity(quantity)} {unit}
      </strong>
    </div>
  );
}
