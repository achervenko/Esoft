import {
  Component,
  lazy,
  Suspense,
  type ComponentType,
  type ReactNode,
} from "react";
import { Sidebar } from "../modules/sidebar";
import type {
  EmployeeProfile,
  UserPhoto,
} from "../shared/api/user-profile-api";
import { resolveAppRoute } from "./app-router";
import {
  canAccessWorkspaceRoute,
  getDefaultAuthRoute,
} from "../lib/role-navigation";
import "./AppShell.css";

type AppShellUser = {
  displayUsername?: string | null;
  employee?: EmployeeProfile | null;
  id?: string | null;
  name?: string | null;
  photo?: UserPhoto | null;
  role?: string | null;
  permissions?: readonly string[];
  username?: string | null;
};

type AppShellProps = {
  onLogout: () => void;
  onUserRefresh?: () => void;
  route: string;
  user: AppShellUser | null;
};

function lazyNamedPage<TProps>(loadPage: () => Promise<ComponentType<TProps>>) {
  return lazy(async () => ({
    default: await loadPage(),
  }));
}

const CalendarPage = lazyNamedPage(() =>
  import("../pages/CalendarPage").then((module) => module.CalendarPage),
);

const DashboardPage = lazyNamedPage(() =>
  import("../pages/DashboardPage").then((module) => module.DashboardPage),
);

const ChecklistAdminPage = lazyNamedPage(() =>
  import("../pages/ChecklistAdminPage").then(
    (module) => module.ChecklistAdminPage,
  ),
);

const ChecklistTemplateEditorPage = lazyNamedPage(() =>
  import("../pages/ChecklistTemplateEditorPage").then(
    (module) => module.ChecklistTemplateEditorPage,
  ),
);

const ChecklistTemplateViewPage = lazyNamedPage(() =>
  import("../pages/ChecklistTemplateViewPage").then(
    (module) => module.ChecklistTemplateViewPage,
  ),
);

const DictionariesPage = lazyNamedPage(() =>
  import("../pages/DictionariesPage").then((module) => module.DictionariesPage),
);

const PpePage = lazyNamedPage(() =>
  import("../pages/PpePage").then((module) => module.PpePage),
);

const EquipmentCreatePage = lazyNamedPage(() =>
  import("../pages/EquipmentCreatePage").then(
    (module) => module.EquipmentCreatePage,
  ),
);

const EquipmentEditPage = lazyNamedPage(() =>
  import("../pages/EquipmentEditPage").then(
    (module) => module.EquipmentEditPage,
  ),
);

const EquipmentPage = lazyNamedPage(() =>
  import("../pages/EquipmentPage").then((module) => module.EquipmentPage),
);

const EquipmentViewPage = lazyNamedPage(() =>
  import("../pages/EquipmentViewPage").then(
    (module) => module.EquipmentViewPage,
  ),
);

const MyChecklistsPage = lazyNamedPage(() =>
  import("../pages/my-checklists").then((module) => module.MyChecklistsPage),
);

const MyChecklistViewPage = lazyNamedPage(() =>
  import("../pages/my-checklists").then((module) => module.MyChecklistViewPage),
);

const ProfilePage = lazyNamedPage(() =>
  import("../pages/ProfilePage").then((module) => module.ProfilePage),
);

const ProductionCalendarPage = lazyNamedPage(() =>
  import("../pages/ProductionCalendarPage").then(
    (module) => module.ProductionCalendarPage,
  ),
);

const SearchPage = lazyNamedPage(() =>
  import("../pages/SearchPage").then((module) => module.SearchPage),
);

const UsersPage = lazyNamedPage(() =>
  import("../pages/UsersPage").then((module) => module.UsersPage),
);

type AppShellRouteBoundaryProps = {
  children: ReactNode;
  routeKey: string;
};

type AppShellRouteBoundaryState = {
  hasError: boolean;
  routeKey: string;
};

class AppShellRouteBoundary extends Component<
  AppShellRouteBoundaryProps,
  AppShellRouteBoundaryState
> {
  state: AppShellRouteBoundaryState = {
    hasError: false,
    routeKey: this.props.routeKey,
  };

  static getDerivedStateFromProps(
    props: AppShellRouteBoundaryProps,
    state: AppShellRouteBoundaryState,
  ) {
    if (props.routeKey !== state.routeKey) {
      return {
        hasError: false,
        routeKey: props.routeKey,
      };
    }

    return null;
  }

  static getDerivedStateFromError() {
    return {
      hasError: true,
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-page-loading app-page-loading--error" role="alert">
          Не удалось открыть раздел. Обновите страницу и попробуйте снова.
        </div>
      );
    }

    return this.props.children;
  }
}

function AppShellPageFallback() {
  return (
    <div className="app-page-loading app-page-loading--section" role="status" aria-live="polite">
      Загрузка раздела...
    </div>
  );
}

export function AppShell({
  onLogout,
  onUserRefresh,
  route,
  user,
}: AppShellProps) {
  const routeAllowed = canAccessWorkspaceRoute(user?.permissions, route);
  const defaultRoute = getDefaultAuthRoute(user?.permissions);
  const fallbackRoute = canAccessWorkspaceRoute(user?.permissions, defaultRoute)
    ? defaultRoute
    : null;
  const appRoute = routeAllowed
    ? resolveAppRoute(route)
    : { kind: "unknown" as const };

  return (
    <main className="app-shell">
      <Sidebar onLogout={onLogout} user={user} />

      <section className="app-workspace" aria-label="Рабочая область">
        <AppShellRouteBoundary routeKey={route}>
          <Suspense fallback={<AppShellPageFallback />}>
            {!routeAllowed && (
              <div role="alert">
                Этот раздел недоступен для вашей роли.{" "}
                {fallbackRoute && <a href={fallbackRoute}>Перейти в доступный раздел</a>}
              </div>
            )}
            {appRoute.kind === "dashboard" ? <DashboardPage /> : null}
            {appRoute.kind === "calendar" ? (
              <CalendarPage
                initialDate={appRoute.date}
                userPermissions={user?.permissions ?? null}
              />
            ) : null}
            {appRoute.kind === "checklist-admin" ? (
              <ChecklistAdminPage userPermissions={user?.permissions ?? null} />
            ) : null}
            {appRoute.kind === "checklist-template-create" ? (
              <ChecklistTemplateEditorPage
                copyFromTemplateId={appRoute.copyFromTemplateId}
                templateId={null}
                userPermissions={user?.permissions ?? null}
              />
            ) : null}
            {appRoute.kind === "checklist-template-view" ? (
              <ChecklistTemplateViewPage
                templateId={appRoute.templateId}
                userPermissions={user?.permissions ?? null}
              />
            ) : null}
            {appRoute.kind === "dictionaries" ? (
              <DictionariesPage userPermissions={user?.permissions ?? null} />
            ) : null}
            {appRoute.kind === "ppe" ? (
              <PpePage
                employeeId={appRoute.employeeId}
                positionId={appRoute.positionId}
                userPermissions={user?.permissions ?? null}
                initialTab={appRoute.tab}
              />
            ) : null}
            {appRoute.kind === "equipment-list" ? (
              <EquipmentPage userPermissions={user?.permissions ?? null} />
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
            {appRoute.kind === "search" ? <SearchPage userPermissions={user?.permissions ?? null} /> : null}
            {appRoute.kind === "profile" ? <ProfilePage user={user} /> : null}
            {appRoute.kind === "production-calendar" ? (
              <ProductionCalendarPage userPermissions={user?.permissions ?? null} />
            ) : null}
            {appRoute.kind === "equipment-create" ? (
              <EquipmentCreatePage userPermissions={user?.permissions ?? null} />
            ) : null}
            {appRoute.kind === "equipment-edit" ? (
              <EquipmentEditPage
                initialTab={appRoute.initialTab}
                returnTo={appRoute.returnTo}
                userPermissions={user?.permissions ?? null}
                visibleId={appRoute.visibleId}
              />
            ) : null}
            {appRoute.kind === "equipment-view" ? (
              <EquipmentViewPage
                eventId={appRoute.eventId}
                initialTab={appRoute.initialTab}
                returnTo={appRoute.returnTo}
                userPermissions={user?.permissions ?? null}
                visibleId={appRoute.visibleId}
              />
            ) : null}
            {appRoute.kind === "users" ? (
              <UsersPage
                currentUserId={user?.id ?? null}
                onCurrentUserChanged={onUserRefresh}
                userPermissions={user?.permissions ?? null}
              />
            ) : null}
          </Suspense>
        </AppShellRouteBoundary>
      </section>
    </main>
  );
}
