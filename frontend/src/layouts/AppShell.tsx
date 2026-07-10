import { Sidebar } from '../modules/sidebar';
import { DashboardPage } from '../pages/DashboardPage';
import { EquipmentCreatePage } from '../pages/EquipmentCreatePage';
import { EquipmentPage } from '../pages/EquipmentPage';
import { EquipmentViewPage } from '../pages/EquipmentViewPage';
import type { EmployeeProfile } from '../shared/api/user-profile-api';
import './AppShell.css';

type AppShellUser = {
  displayUsername?: string | null;
  employee?: EmployeeProfile | null;
  name?: string | null;
  role?: string | null;
  username?: string | null;
};

type AppShellProps = {
  onLogout: () => void;
  route: string;
  user: AppShellUser | null;
};

export function AppShell({ onLogout, route, user }: AppShellProps) {
  const isDashboardRoute = route === '#/dashboard';
  const isEquipmentRoute = route === '#/equipment';
  const isEquipmentCreateRoute = route === '#/equipment/create';
  const equipmentViewMatch = route.match(/^#\/equipment\/(\d+)$/);
  const equipmentViewId = equipmentViewMatch ? Number(equipmentViewMatch[1]) : null;

  return (
    <main className="app-shell">
      <Sidebar onLogout={onLogout} user={user} />

      <section className="app-workspace" aria-label="Рабочая область">
        {isDashboardRoute ? <DashboardPage /> : null}
        {isEquipmentRoute ? <EquipmentPage userRole={user?.role ?? null} /> : null}
        {isEquipmentCreateRoute ? <EquipmentCreatePage userRole={user?.role ?? null} /> : null}
        {equipmentViewId !== null ? <EquipmentViewPage visibleId={equipmentViewId} /> : null}
      </section>
    </main>
  );
}
