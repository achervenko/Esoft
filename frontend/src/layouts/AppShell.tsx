import { Suspense } from "react";
import { AppRouteContent } from "./AppRouteContent";
import {
  AppShellRouteBoundary,
  AppShellPageFallback,
} from "./AppShellRouteBoundary";
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

export type AppShellUser = {
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
                {fallbackRoute && (
                  <a href={fallbackRoute}>Перейти в доступный раздел</a>
                )}
              </div>
            )}
            <AppRouteContent
              appRoute={appRoute}
              user={user}
              onUserRefresh={onUserRefresh}
            />
          </Suspense>
        </AppShellRouteBoundary>
      </section>
    </main>
  );
}
