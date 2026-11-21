import { ReceiptIntegrationPanel } from "./ReceiptIntegrationPanel";

export function IntegrationsPanel({
  permissions,
}: {
  permissions: readonly string[] | null;
}) {
  return (
    <section aria-label="Интеграции">
      <ReceiptIntegrationPanel permissions={permissions} />
    </section>
  );
}
