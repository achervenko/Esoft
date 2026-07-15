import { Sidebar } from "../modules/sidebar";
import { parseEquipmentViewTab } from "../modules/equipment-card";
import { DashboardPage } from "../pages/DashboardPage";
import { DictionariesPage } from "../pages/DictionariesPage";
import { EquipmentCreatePage } from "../pages/EquipmentCreatePage";
import { EquipmentEditPage } from "../pages/EquipmentEditPage";
import { EquipmentPage } from "../pages/EquipmentPage";
import { EquipmentViewPage } from "../pages/EquipmentViewPage";
import { ProfilePage } from "../pages/ProfilePage";
import { SearchPage } from "../pages/SearchPage";
import { UsersPage } from "../pages/UsersPage";
import type {
  EmployeeProfile,
  UserPhoto,
} from "../shared/api/user-profile-api";
import {
  getHashRouteParam,
  getSafeReturnTo,
} from "../shared/lib/hash-navigation";
import "./AppShell.css";

type AppShellUser = {
  displayUsername?: string | null;
  employee?: EmployeeProfile | null;
  id?: string | null;
  name?: string | null;
  photo?: UserPhoto | null;
  role?: string | null;
  username?: string | null;
};

type AppShellProps = {
  onLogout: () => void;
  onUserRefresh?: () => void;
  route: string;
  user: AppShellUser | null;
};

export function AppShell({
  onLogout,
  onUserRefresh,
  route,
  user,
}: AppShellProps) {
  const isDashboardRoute = route === "#/dashboard";
  const isDictionariesRoute = route === "#/dictionaries";
  const isEquipmentRoute = route === "#/equipment";
  const isProfileRoute = route === "#/profile";
  const isSearchRoute = route === "#/search" || route.startsWith("#/search?");
  const isUsersRoute = route === "#/users";
  const isEquipmentCreateRoute = route === "#/equipment/create";
  const equipmentEditMatch = route.match(
    /^#\/equipment\/(\d+)\/edit(?:\?.*)?$/,
  );
  const equipmentEditId = equipmentEditMatch
    ? Number(equipmentEditMatch[1])
    : null;
  const equipmentEditTabParam = getHashRouteParam(route, "tab");
  const equipmentEditTab =
    equipmentEditTabParam === "documents" ? "documents" : "details";
  const equipmentEditReturnTo = getSafeReturnTo(
    getHashRouteParam(route, "returnTo"),
  );
  const equipmentViewMatch = route.match(/^#\/equipment\/(\d+)(?:\?.*)?$/);
  const equipmentViewId = equipmentViewMatch
    ? Number(equipmentViewMatch[1])
    : null;
  const equipmentViewTab = parseEquipmentViewTab(
    getHashRouteParam(route, "tab"),
  );
  const equipmentViewReturnTo = getSafeReturnTo(
    getHashRouteParam(route, "returnTo"),
  );

  return (
    <main className="app-shell">
      <Sidebar onLogout={onLogout} user={user} />

      <section className="app-workspace" aria-label="Рабочая область">
        {isDashboardRoute ? <DashboardPage /> : null}
        {isDictionariesRoute ? (
          <DictionariesPage userRole={user?.role ?? null} />
        ) : null}
        {isEquipmentRoute ? (
          <EquipmentPage userRole={user?.role ?? null} />
        ) : null}
        {isSearchRoute ? <SearchPage /> : null}
        {isProfileRoute ? <ProfilePage user={user} /> : null}
        {isEquipmentCreateRoute ? (
          <EquipmentCreatePage userRole={user?.role ?? null} />
        ) : null}
        {equipmentEditId !== null ? (
          <EquipmentEditPage
            initialTab={equipmentEditTab}
            returnTo={equipmentEditReturnTo}
            userRole={user?.role ?? null}
            visibleId={equipmentEditId}
          />
        ) : null}
        {equipmentViewId !== null ? (
          <EquipmentViewPage
            initialTab={equipmentViewTab}
            returnTo={equipmentViewReturnTo}
            userRole={user?.role ?? null}
            visibleId={equipmentViewId}
          />
        ) : null}
        {isUsersRoute ? (
          <UsersPage
            currentUserId={user?.id ?? null}
            onCurrentUserChanged={onUserRefresh}
            userRole={user?.role ?? null}
          />
        ) : null}
      </section>
    </main>
  );
}
