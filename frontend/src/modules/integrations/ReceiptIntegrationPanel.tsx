import { useRef, useState } from "react";
import { getApiErrorMessage } from "../../shared/api/api-error";
import { hasPermission } from "../../shared/lib/permissions";
import { Notice } from "../../shared/ui/Notice";
import { LoadingIndicator } from "../../shared/ui/LoadingIndicator";
import { IntegrationSourcesSection } from "./IntegrationSourcesSection";
import { IntegrationKeysSection } from "./IntegrationKeysSection";
import { IntegrationEventsSection } from "./IntegrationEventsSection";
import { useReceiptIntegrationData } from "./useReceiptIntegrationData";
import { useReceiptIntegrationKeys } from "./useReceiptIntegrationKeys";
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
  const [status, setStatus] = useState("PENDING");
  const [selected, setSelected] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const { sources, availableFlows, events, loading, error, setError } =
    useReceiptIntegrationData(revision, page, status);
  const keys = useReceiptIntegrationKeys(selected, revision, setError);
  const reload = () => setRevision((n) => n + 1);
  const mutate = async (run: () => Promise<unknown>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await run();
      reload();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  return (
    <div className="admin-form receipt-integration-panel">
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
      <IntegrationKeysSection
        sources={sources}
        availableFlows={availableFlows}
        keys={keys}
        selected={selected}
        setSelected={setSelected}
        busy={busy}
        mutate={mutate}
        reload={reload}
      />
      <IntegrationEventsSection
        events={events}
        status={status}
        setStatus={setStatus}
        page={page}
        setPage={setPage}
        busy={busy}
        loading={loading}
        mutate={mutate}
        reload={reload}
      />
    </div>
  );
}
