import { Sidebar } from "../modules/sidebar";
import { DashboardPage } from "../pages/DashboardPage";
import { ChecklistAdminPage } from "../pages/ChecklistAdminPage";
import { ChecklistTemplateEditorPage } from "../pages/ChecklistTemplateEditorPage";
import { ChecklistTemplateViewPage } from "../pages/ChecklistTemplateViewPage";
import { DictionariesPage } from "../pages/DictionariesPage";
import { EquipmentCreatePage } from "../pages/EquipmentCreatePage";
import { EquipmentEditPage } from "../pages/EquipmentEditPage";
import { EquipmentPage } from "../pages/EquipmentPage";
import { EquipmentViewPage } from "../pages/EquipmentViewPage";
import { MyChecklistsPage, MyChecklistViewPage } from "../pages/my-checklists";
import { ProfilePage } from "../pages/ProfilePage";
import { SearchPage } from "../pages/SearchPage";
import { UsersPage } from "../pages/UsersPage";
import type {
  EmployeeProfile,
  UserPhoto,
} from "../shared/api/user-profile-api";
import { resolveAppRoute } from "./app-router";
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
  const appRoute = resolveAppRoute(route);

  return (
    <main className="app-shell">
      <Sidebar onLogout={onLogout} user={user} />

      <section className="app-workspace" aria-label="Рабочая область">
        {appRoute.kind === "dashboard" ? <DashboardPage /> : null}
        {appRoute.kind === "checklist-admin" ? (
          <ChecklistAdminPage userRole={user?.role ?? null} />
        ) : null}
        {appRoute.kind === "checklist-template-create" ? (
          <ChecklistTemplateEditorPage
            copyFromTemplateId={appRoute.copyFromTemplateId}
            templateId={null}
            userRole={user?.role ?? null}
          />
        ) : null}
        {appRoute.kind === "checklist-template-view" ? (
          <ChecklistTemplateViewPage
            templateId={appRoute.templateId}
            userRole={user?.role ?? null}
          />
        ) : null}
        {appRoute.kind === "dictionaries" ? (
          <DictionariesPage userRole={user?.role ?? null} />
        ) : null}
        {appRoute.kind === "equipment-list" ? (
          <EquipmentPage userRole={user?.role ?? null} />
        ) : null}
        {appRoute.kind === "my-checklists-list" ? (
          <MyChecklistsPage route={appRoute.route} />
        ) : null}
        {appRoute.kind === "my-checklists-view" ? (
          <MyChecklistViewPage
            fallbackTab={appRoute.fallbackTab}
            checklistId={appRoute.checklistId}
            currentUserId={user?.id ?? null}
          />
        ) : null}
        {appRoute.kind === "search" ? <SearchPage /> : null}
        {appRoute.kind === "profile" ? <ProfilePage user={user} /> : null}
        {appRoute.kind === "equipment-create" ? (
          <EquipmentCreatePage userRole={user?.role ?? null} />
        ) : null}
        {appRoute.kind === "equipment-edit" ? (
          <EquipmentEditPage
            initialTab={appRoute.initialTab}
            returnTo={appRoute.returnTo}
            userRole={user?.role ?? null}
            visibleId={appRoute.visibleId}
          />
        ) : null}
        {appRoute.kind === "equipment-view" ? (
          <EquipmentViewPage
            initialTab={appRoute.initialTab}
            returnTo={appRoute.returnTo}
            userRole={user?.role ?? null}
            visibleId={appRoute.visibleId}
          />
        ) : null}
        {appRoute.kind === "users" ? (
          <UsersPage
            onCurrentUserChanged={onUserRefresh}
            userRole={user?.role ?? null}
          />
        ) : null}
      </section>
    </main>
  );
}
