import type { StockDistribution } from "../../shared/api/warehouse-stock-api";
import { ArrowRight } from "lucide-react";
import { formatStockQuantity, quantityMillis } from "./stock-page.utils";

function StockShelf() {
  return (
    <svg
      className="stock-transfer-shelf"
      viewBox="0 0 104 128"
      fill="none"
      aria-hidden="true"
    >
      <g
        transform="translate(104 0) scale(-1 1)"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      >
        <ellipse cx="50" cy="116" rx="39" ry="7" fill="#e5e5e5" stroke="none" />
        <path d="M37 10V88M85 38V116" stroke="#8a8a8a" strokeWidth="3" />
        {[44, 84].map((y) => (
          <g key={y}>
            <path
              d={`M13 ${y} L37 ${y - 14} L85 ${y + 14} L61 ${y + 28} Z`}
              fill="#f0f0f0"
              stroke="#555"
            />
            <path
              d={`M13 ${y} L61 ${y + 28} L61 ${y + 31} L13 ${y + 3} Z`}
              fill="#777"
              stroke="none"
            />
            <path
              d={`M61 ${y + 28} L85 ${y + 14} L85 ${y + 17} L61 ${y + 31} Z`}
              fill="#aaa"
              stroke="none"
            />
            {[19, 42].map((x, index) => (
              <g
                key={x}
                transform={`translate(${x} ${y - 3 + index * 13.4})`}
                stroke="#555"
              >
                <path d="M0 -20 L19 -9 L19 11 L0 0 Z" fill="#dedede" />
                <path d="M19 -9 L32 -16.5 L32 3.5 L19 11 Z" fill="#b8b8b8" />
                <path d="M0 -20 L13 -27.5 L32 -16.5 L19 -9 Z" fill="#fafafa" />
                <path
                  d="M8 -15.4 L21 -22.9 L24 -21.2 L11 -13.7 V-7 L8 -8.7 Z"
                  fill="#999"
                  stroke="none"
                />
              </g>
            ))}
          </g>
        ))}
        <path
          d="M13 18V96M61 46V124M13 18L37 4L85 32L61 46Z"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

function formatAmount(amount: bigint) {
  return formatStockQuantity(
    `${amount / 1000n}${amount % 1000n ? "." + (amount % 1000n).toString().padStart(3, "0").replace(/0+$/, "") : ""}`,
  );
}

export function StockTransferPreview({
  data,
  source,
  destination,
  amount,
  valid,
}: {
  data: StockDistribution;
  source: StockDistribution["locations"][number];
  destination?: { warehouse: string; location: string };
  amount: bigint | null;
  valid: boolean;
}) {
  const quantity = valid && amount !== null ? formatAmount(amount) : "—";
  const sourceQuantity = quantityMillis(source.quantity);
  return (
    <section className="stock-transfer-summary" aria-label="Итог перемещения">
      <div className="stock-transfer-summary-grid">
        <div>
          <StockShelf />
          <div className="stock-transfer-place-text">
            <span>Откуда</span>
            <strong>{source.location.name}</strong>
            <p>{data.warehouse.name}</p>
            <span className="stock-transfer-place-result">
              {valid && amount !== null && sourceQuantity !== null
                ? `Останется: ${formatAmount(sourceQuantity - amount)} ${data.item.unit}`
                : null}
            </span>
          </div>
        </div>
        <div className="stock-transfer-connector">
          <span>
            <ArrowRight size={22} aria-hidden="true" />
          </span>
          <strong aria-label="К перемещению">
            {quantity}
            {valid ? ` ${data.item.unit}` : ""}
          </strong>
        </div>
        <div>
          <StockShelf />
          <div className="stock-transfer-place-text">
            <span>Куда</span>
            <strong>
              {destination?.location ?? "Выберите место хранения"}
            </strong>
            <p>{destination?.warehouse ?? "Выберите склад"}</p>
            <span className="stock-transfer-place-result">
              {valid ? `Добавится: ${quantity} ${data.item.unit}` : null}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
