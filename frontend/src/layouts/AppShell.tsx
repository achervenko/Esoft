import { Sidebar } from "../modules/sidebar";
import { parseEquipmentViewTab } from "../modules/equipment-card";
import { DashboardPage } from "../pages/DashboardPage";
import { ChecklistAdminPage } from "../pages/ChecklistAdminPage";
import { ChecklistTemplateEditorPage } from "../pages/ChecklistTemplateEditorPage";
import { ChecklistTemplateViewPage } from "../pages/ChecklistTemplateViewPage";
import { DictionariesPage } from "../pages/DictionariesPage";
import { EquipmentCreatePage } from "../pages/EquipmentCreatePage";
import { EquipmentEditPage } from "../pages/EquipmentEditPage";
import { EquipmentPage } from "../pages/EquipmentPage";
import { EquipmentViewPage } from "../pages/EquipmentViewPage";
import { MyChecklistsPage } from "../pages/my-checklists";
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
  const isChecklistAdminRoute =
    route === "#/checklist-admin" || route.startsWith("#/checklist-admin?");
  const isDictionariesRoute = route === "#/dictionaries";
  const isEquipmentRoute = route === "#/equipment";
  const isMyChecklistsRoute =
    route === "#/my-checklists" || route.startsWith("#/my-checklists?");
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
  const checklistTemplateViewMatch = route.match(
    /^#\/checklist-admin\/templates\/(\d+)(?:\?.*)?$/,
  );
  const isChecklistTemplateCreateRoute = route.match(
    /^#\/checklist-admin\/templates\/new(?:\?.*)?$/,
  );
  const checklistTemplateViewId = checklistTemplateViewMatch
    ? Number(checklistTemplateViewMatch[1])
    : null;
  const checklistTemplateCopyFromParam = getHashRouteParam(route, "copyFrom");
  const checklistTemplateCopyFromNumber = checklistTemplateCopyFromParam
    ? Number(checklistTemplateCopyFromParam)
    : NaN;
  const checklistTemplateCopyFromId = Number.isInteger(
    checklistTemplateCopyFromNumber,
  ) && checklistTemplateCopyFromNumber > 0
    ? checklistTemplateCopyFromNumber
    : null;

  return (
    <main className="app-shell">
      <Sidebar onLogout={onLogout} user={user} />

      <section className="app-workspace" aria-label="Рабочая область">
        {isDashboardRoute ? <DashboardPage /> : null}
        {isChecklistAdminRoute ? (
          <ChecklistAdminPage userRole={user?.role ?? null} />
        ) : null}
        {isChecklistTemplateCreateRoute ? (
          <ChecklistTemplateEditorPage
            copyFromTemplateId={checklistTemplateCopyFromId}
            templateId={null}
            userRole={user?.role ?? null}
          />
        ) : null}
        {checklistTemplateViewId !== null ? (
          <ChecklistTemplateViewPage
            templateId={checklistTemplateViewId}
            userRole={user?.role ?? null}
          />
        ) : null}
        {isDictionariesRoute ? (
          <DictionariesPage userRole={user?.role ?? null} />
        ) : null}
        {isEquipmentRoute ? (
          <EquipmentPage userRole={user?.role ?? null} />
        ) : null}
        {isMyChecklistsRoute ? (
          <MyChecklistsPage
            currentUserId={user?.id ?? null}
            route={route}
          />
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
            onCurrentUserChanged={onUserRefresh}
            userRole={user?.role ?? null}
          />
        ) : null}
      </section>
    </main>
  );
}
