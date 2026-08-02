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

function lazyNamedPage<TProps>(
  loadPage: () => Promise<ComponentType<TProps>>,
) {
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

const EquipmentCreatePage = lazyNamedPage(() =>
  import("../pages/EquipmentCreatePage").then(
    (module) => module.EquipmentCreatePage,
  ),
);

const EquipmentEditPage = lazyNamedPage(() =>
  import("../pages/EquipmentEditPage").then((module) => module.EquipmentEditPage),
);

const EquipmentPage = lazyNamedPage(() =>
  import("../pages/EquipmentPage").then((module) => module.EquipmentPage),
);

const EquipmentViewPage = lazyNamedPage(() =>
  import("../pages/EquipmentViewPage").then((module) => module.EquipmentViewPage),
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
};

class AppShellRouteBoundary extends Component<
  AppShellRouteBoundaryProps,
  AppShellRouteBoundaryState
> {
  state: AppShellRouteBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return {
      hasError: true,
    };
  }

  componentDidUpdate(previousProps: AppShellRouteBoundaryProps) {
    if (
      previousProps.routeKey !== this.props.routeKey &&
      this.state.hasError
    ) {
      this.setState({
        hasError: false,
      });
    }
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
    <div className="app-page-loading" role="status" aria-live="polite">
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
  const appRoute = resolveAppRoute(route);

  return (
    <main className="app-shell">
      <Sidebar onLogout={onLogout} user={user} />

      <section className="app-workspace" aria-label="Рабочая область">
        <AppShellRouteBoundary routeKey={route}>
          <Suspense fallback={<AppShellPageFallback />}>
            {appRoute.kind === "dashboard" ? <DashboardPage /> : null}
            {appRoute.kind === "calendar" ? (
              <CalendarPage
                initialDate={appRoute.date}
                userRole={user?.role ?? null}
              />
            ) : null}
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
            {appRoute.kind === "production-calendar" ? (
              <ProductionCalendarPage userRole={user?.role ?? null} />
            ) : null}
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
                eventId={appRoute.eventId}
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
          </Suspense>
        </AppShellRouteBoundary>
      </section>
    </main>
  );
}
