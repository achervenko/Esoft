import { Sidebar } from '../modules/sidebar';
import { EquipmentCreatePage } from '../pages/EquipmentCreatePage';
import { EquipmentPage } from '../pages/EquipmentPage';
import './AppShell.css';

type AppShellUser = {
  displayUsername?: string | null;
  firstName?: string | null;
  middleName?: string | null;
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
  const isEquipmentRoute = route === '#/equipment';
  const isEquipmentCreateRoute = route === '#/equipment/create';

  return (
    <main className="app-shell">
      <Sidebar onLogout={onLogout} user={user} />

      <section className="app-workspace" aria-label="Рабочая область">
        {isEquipmentRoute ? <EquipmentPage userRole={user?.role ?? null} /> : null}
        {isEquipmentCreateRoute ? <EquipmentCreatePage userRole={user?.role ?? null} /> : null}
      </section>
    </main>
  );
}
