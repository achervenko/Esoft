import { ReceiptIntegrationPanel } from "./ReceiptIntegrationPanel";

export function IntegrationsPanel({
  permissions,
}: {
  permissions: readonly string[] | null;
}) {
  return (
    <section className="admin-form" aria-label="Интеграции">
      <header className="admin-page-header">
        <h2>Интеграции</h2>
      </header>
      <ReceiptIntegrationPanel permissions={permissions} />
    </section>
  );
}
