import "./WarehouseLocationSummary.css";
import { MapPin } from "lucide-react";
import type { ReactNode } from "react";
import { formatStockQuantity } from "../lib/warehouse-quantity";
export function WarehouseLocationSummary({
  name,
  quantity,
  unit,
  action,
}: {
  name: string;
  quantity: string;
  unit: string;
  action?: ReactNode;
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
      {action}
    </div>
  );
}
