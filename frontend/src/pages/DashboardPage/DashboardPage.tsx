import "./DashboardPage.css";
import { EquipmentProgressDashboard } from "../../modules/equipment-progress-dashboard";

export function DashboardPage() {
  return (
    <div className="dashboard-page">
      <header className="dashboard-page-header">
        <h1 className="page-title">Панель</h1>
      </header>

      <EquipmentProgressDashboard />
    </div>
  );
}
