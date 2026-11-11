import { hasPermission } from "../../shared/lib/permissions";
import type { ReservationOperation } from "./reservation-operation";
import { useId } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Reservation } from "../../shared/api/warehouse-reservations-api";
import {
  formatStockQuantity,
  quantityMillis,
} from "../../shared/lib/warehouse-quantity";
import { WarehouseLocationSummary } from "../../shared/warehouse/WarehouseLocationSummary";
import { WarehouseItemIdentity } from "../../shared/warehouse/WarehouseItemIdentity";
import { countNoun } from "./reservation-count";

export function ReservationItemRow({
  reservation: r,
  expanded,
  onToggle,
  permissions = [],
  onOperation,
}: {
  reservation: Reservation;
  expanded: boolean;
  onToggle: () => void;
  permissions?: readonly string[] | null;
  onOperation?: (operation: ReservationOperation) => void;
}) {
  const detailsId = useId();
  const manage = hasPermission(permissions, "warehouse.reservations.manage");
  const coverage = hasPermission(
    permissions,
    "warehouse.reservations.coverage.manage",
  );
  const places = r.allocations.filter(
    (a) => (quantityMillis(a.quantity) ?? 0n) > 0n,
  );
  const deficit = (quantityMillis(r.deficitQuantity) ?? 0n) > 0n;
  return (
    <div className="reservation-item">
      <button
        type="button"
        className="reservation-item-button"
        aria-expanded={expanded}
        aria-controls={expanded ? detailsId : undefined}
        onClick={onToggle}
      >
        {expanded ? (
          <ChevronDown size={17} aria-hidden="true" />
        ) : (
          <ChevronRight size={17} aria-hidden="true" />
        )}
        <span className="reservation-item-name">
          <WarehouseItemIdentity name={r.item.name} article={r.item.article} />
          <small>
            {places.length}{" "}
            {countNoun(places.length, ["место", "места", "мест"])}
          </small>
        </span>
        <span className="reservation-item-amount">
          <small
            className={deficit ? "reservation-deficit" : "reservation-covered"}
          >
            {deficit
              ? `Дефицит ${formatStockQuantity(r.deficitQuantity)} ${r.item.unit}`
              : "Обеспечен"}
          </small>
          <strong>
            {deficit && `${formatStockQuantity(r.coveredQuantity)} / `}
            {formatStockQuantity(r.quantity)} {r.item.unit}
          </strong>
        </span>
      </button>
      {expanded && (
        <div className="reservation-item-locations" id={detailsId}>
          {onOperation && (manage || (coverage && deficit)) && (
            <div className="reservation-operation-actions">
              {manage && (
                <button
                  type="button"
                  className="admin-secondary-button"
                  onClick={() =>
                    onOperation({ kind: "decrease", reservation: r })
                  }
                >
                  Уменьшить резерв
                </button>
              )}
              {coverage && deficit && (
                <button
                  type="button"
                  className="admin-secondary-button"
                  onClick={() =>
                    onOperation({ kind: "restore", reservation: r })
                  }
                >
                  Обеспечить
                </button>
              )}
            </div>
          )}
          {places.map((a) => (
            <div
              key={a.id}
              title={`${a.location.warehouse.name}${a.location.isActive ? "" : " · Место неактивно"}`}
            >
              <WarehouseLocationSummary
                name={a.location.name}
                quantity={a.quantity}
                unit={r.item.unit}
              />
              {onOperation && coverage && (
                <div className="reservation-operation-actions">
                  {coverage && (
                    <button
                      type="button"
                      className="admin-secondary-button"
                      onClick={() =>
                        onOperation({
                          kind: "reduce",
                          reservation: r,
                          locationId: a.location.id,
                        })
                      }
                    >
                      Снять обеспеченность
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          {deficit && (
            <div className="reservation-uncovered reservation-deficit">
              <span>Не обеспечено</span>
              <strong>
                {formatStockQuantity(r.deficitQuantity)} {r.item.unit}
              </strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
