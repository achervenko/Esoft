import { useEffect, useState } from "react";
import { Forklift } from "lucide-react";
import { AdminModal } from "../../shared/ui/AdminModal";
import { AppTable } from "../../shared/ui/AppTable";
import { Notice } from "../../shared/ui/Notice";
import {
  warehouseStockApi,
  type StockPosition,
  type StockDistribution,
} from "../../shared/api/warehouse-stock-api";
import { getApiErrorMessage } from "../../shared/api/api-error";
import { StockTransferProduct } from "./StockTransferPreview";
import "./StockTransferForm.css";
import { StockTransferForm } from "./StockTransferForm";
import { formatStockQuantity, quantityMillis } from "./stock-page.utils";
export function StockDistributionModal({
  position,
  canTransfer,
  onClose,
  onChanged,
}: {
  position: StockPosition;
  canTransfer: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [data, setData] = useState<StockDistribution | null>(null),
    [error, setError] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  const [source, setSource] = useState<
    StockDistribution["locations"][number] | null
  >(null);
  const [transferSaving, setTransferSaving] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    setError(null);
    void warehouseStockApi
      .distribution(position.item.id, position.warehouse.id, c.signal)
      .then((result) => {
        if (!c.signal.aborted) setData(result);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(getApiErrorMessage(e));
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [position.item.id, position.warehouse.id, revision]);
  if (source && data)
    return (
      <AdminModal
        title="Переместить остаток"
        className="stock-transfer-modal"
        onClose={() => setSource(null)}
        isCloseDisabled={transferSaving}
      >
        <StockTransferForm
          embedded
          onSavingChange={setTransferSaving}
          data={data}
          source={source}
          onClose={() => setSource(null)}
          onSaved={() => {
            setSource(null);
            setRevision((v) => v + 1);
            onChanged();
          }}
        />
      </AdminModal>
    );
  const current = data ?? {
    item: position.item,
    warehouse: position.warehouse,
    totalQuantity: position.quantity,
  };
  return (
    <AdminModal
      title={`Места хранения (${current.warehouse.name})`}
      onClose={onClose}
    >
      <div className="admin-form">
        <StockTransferProduct data={current} />
        {loading && <p role="status">Обновление распределения…</p>}
        {error && (
          <Notice tone="error">
            {error}
            <button
              type="button"
              className="admin-secondary-button"
              onClick={() => setRevision((v) => v + 1)}
            >
              Повторить загрузку
            </button>
          </Notice>
        )}
        {data && (
          <AppTable incremental={false}>
            <thead>
              <tr>
                <th>Место хранения</th>
                <th className="stock-distribution-quantity">Количество</th>
                {canTransfer && (
                  <th
                    className="stock-transfer-action-column"
                    aria-label="Действия"
                  />
                )}
              </tr>
            </thead>
            <tbody>
              {data.locations.map((b) => (
                <tr key={b.balanceId}>
                  <td>
                    {b.location.name}
                    {!b.location.isActive && (
                      <small className="stock-inactive">Место неактивно</small>
                    )}
                  </td>
                  <td className="stock-distribution-quantity">
                    {formatStockQuantity(b.quantity)} {data.item.unit}
                  </td>
                  {canTransfer && (
                    <td className="stock-transfer-action-column">
                      <button
                        type="button"
                        className="admin-secondary-button stock-transfer-icon-button"
                        aria-label="Переместить"
                        title="Переместить"
                        disabled={
                          loading ||
                          !!error ||
                          !data.item.isActive ||
                          !data.warehouse.isActive ||
                          !b.location.isActive ||
                          (quantityMillis(b.available) ?? 0n) <= 0n
                        }
                        onClick={() => setSource(b)}
                      >
                        <Forklift size={20} aria-hidden="true" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </AppTable>
        )}
        {data && !data.locations.length && (
          <p>Остатки в местах хранения отсутствуют.</p>
        )}
      </div>
    </AdminModal>
  );
}
