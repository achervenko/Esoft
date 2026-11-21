import { useState } from "react";
import { hasPermission } from "../../shared/lib/permissions";
import { Notice } from "../../shared/ui/Notice";
import { LoadingIndicator } from "../../shared/ui/LoadingIndicator";
import { IntegrationSourcesSection } from "./IntegrationSourcesSection";
import { IntegrationRunsSection } from "./IntegrationRunsSection";
import { useReceiptIntegrationData } from "./useReceiptIntegrationData";
import "./ReceiptIntegrationPanel.css";

export function ReceiptIntegrationPanel({
  permissions,
}: {
  permissions: readonly string[] | null;
}) {
  if (!hasPermission(permissions, "integrations.manage"))
    return (
      <Notice tone="error">Недостаточно прав для настройки обмена.</Notice>
    );
  return <IntegrationContent />;
}
function IntegrationContent() {
  const [revision, setRevision] = useState(0);
  const { sources, availableFlows, loading, error } =
    useReceiptIntegrationData(revision);
  const reload = () => setRevision((n) => n + 1);
  return (
    <div className="admin-nested-sections receipt-integration-panel">
      {error && (
        <Notice tone="error">
          {error} <button onClick={reload}>Повторить</button>
        </Notice>
      )}
      <LoadingIndicator loading={loading} />
      <IntegrationSourcesSection
        sources={sources}
        availableFlows={availableFlows}
        loading={loading}
        reload={reload}
      />
      <IntegrationRunsSection sources={sources} />
    </div>
  );
}
