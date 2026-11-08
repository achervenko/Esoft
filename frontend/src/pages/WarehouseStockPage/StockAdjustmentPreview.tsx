import { StockLocationSummary } from "./StockLocationSummary";
import { formatStockQuantity } from "./stock-page.utils";
import type { StockAdjustmentFormProps } from "./useStockAdjustmentForm";
type PreviewProps = Pick<StockAdjustmentFormProps, "data" | "balance">;
export function StockAdjustmentSummary({ data, balance }: PreviewProps) {
  return (
    <div>
      <div className="stock-adjust-item">
        <strong>{data.item.name}</strong>
        <small>Артикул: {data.item.article ?? "Не указан"}</small>
      </div>
      <StockLocationSummary
        name={balance.location.name}
        quantity={balance.quantity}
        unit={data.item.unit}
      />
    </div>
  );
}
export function StockAdjustmentPreview({
  data,
  amount,
  delta,
}: PreviewProps & { amount: bigint | null; delta: bigint }) {
  return (
    <>
      {" "}
      <div
        className="stock-adjust-preview"
        data-expanded={amount !== null && delta !== 0n}
        aria-hidden={amount === null || delta === 0n}
      >
        <div>
          <div className="stock-adjust-change">
            <span className="form-field-label">Изменение остатка</span>
            <p>
              <strong>
                {delta < 0n ? "−" : "+"}
                {formatStockQuantity(
                  `${(delta < 0n ? -delta : delta) / 1000n}.${((delta < 0n ? -delta : delta) % 1000n).toString().padStart(3, "0")}`.replace(
                    /\.?0+$/,
                    "",
                  ),
                )}{" "}
                {data.item.unit}
              </strong>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
