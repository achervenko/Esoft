import "./DashboardPage.css";
import { EquipmentProgressDashboard } from "../../modules/equipment-progress-dashboard";
import { hasPermission } from "../../shared/lib/permissions";
import { NotificationsFeed } from "../../modules/notifications-feed";

export function DashboardPage({
  permissions,
}: {
  permissions: readonly string[] | null;
}) {
  return (
    <div className="dashboard-page">
      <header className="dashboard-page-header">
        <h1 className="page-title">Панель</h1>
      </header>

      {hasPermission(permissions, "notifications.read") && (
        <NotificationsFeed permissions={permissions} />
      )}
      {hasPermission(permissions, "equipment.progress.read") && (
        <EquipmentProgressDashboard />
      )}
    </div>
  );
}
