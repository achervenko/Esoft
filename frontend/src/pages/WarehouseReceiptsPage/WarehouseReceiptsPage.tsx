import { useState } from "react";
import { hasPermission } from "../../shared/lib/permissions";
import { setHashRoute } from "../../lib/hash-router";
import { Notice } from "../../shared/ui/Notice";
import { ReceiptDetails } from "./ReceiptDetails";
import { ReceiptManualForm } from "./ReceiptManualForm";
import { ReceiptList } from "./ReceiptList";
import { defaultPreferences } from "./receipt-list-preferences";
import "../../shared/ui/AdminPage.css";
import "./WarehouseReceipts.css";
import "./ReceiptList.css";
import "./ReceiptCards.css";
import "./ReceiptStates.css";
import "./ReceiptManualForm.css";

export function WarehouseReceiptsPage({
  userPermissions,
  actorId = null,
  receiptId,
  creating = false,
}: {
  userPermissions: readonly string[] | null;
  actorId?: string | null;
  receiptId?: string;
  creating?: boolean;
}) {
  const [savedPreferences, setSavedPreferences] = useState({
    actorId,
    value: defaultPreferences,
  });
  const preferences =
    savedPreferences.actorId === actorId
      ? savedPreferences.value
      : defaultPreferences;
  if (!hasPermission(userPermissions, "warehouse.receipts.read"))
    return (
      <section className="admin-page">
        <Notice tone="error">Недостаточно прав для просмотра приходов.</Notice>
      </section>
    );
  const back = () => setHashRoute("#/warehouse/receipts");
  return (
    <section className="admin-page warehouse-receipts-page">
      {receiptId ? (
        <ReceiptDetails
          key={`${actorId}:${receiptId}`}
          actorId={actorId}
          id={receiptId}
          permissions={userPermissions}
          onBack={back}
        />
      ) : (
        <ReceiptList
          key={`list:${actorId}`}
          permissions={userPermissions}
          preferences={preferences}
          onChange={(value) => setSavedPreferences({ actorId, value })}
        />
      )}
      {creating &&
        (hasPermission(userPermissions, "warehouse.receipts.manage") ? (
          <ReceiptManualForm
            canCreateItems={hasPermission(
              userPermissions,
              "warehouse.catalog.manage",
            )}
            key={`manual:${actorId}`}
            actorId={actorId}
            onCancel={back}
            onCreated={(id) => setHashRoute(`#/warehouse/receipts/${id}`)}
          />
        ) : (
          <Notice tone="error">Недостаточно прав для создания прихода.</Notice>
        ))}
    </section>
  );
}
