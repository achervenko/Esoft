import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "./layouts/AppShell";
import { authClient } from "./lib/auth-client";
import {
  LOGIN_ROUTE,
  SETUP_ROUTE,
  getHashRoute,
  isLoginRoute,
  isSetupRoute,
  setHashRoute,
  subscribeHashRouteNavigation,
} from "./lib/hash-router";
import {
  canAccessWorkspaceRoute,
  getDefaultAuthRoute,
} from "./lib/role-navigation";
import { LoginPage } from "./pages/LoginPage";
import { SetupPage } from "./pages/SetupPage";
import {
  getAuthenticatedUser,
  waitForAuthenticatedUser,
  type SessionUser,
} from "./shared/api/auth-session";
import { getSetupStatus } from "./shared/api/setup";
import { subscribeSessionExpired } from "./shared/api/session-expired";
import { markCurrentHashHistoryEntry } from "./shared/lib/hash-history-marker";

function App() {
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isCheckingSetup, setIsCheckingSetup] = useState(true);
  const [setupCheckRevision, setSetupCheckRevision] = useState(0);
  const [route, setRouteState] = useState(getHashRoute);
  const routeRef = useRef(route);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const setupRequiredRef = useRef(setupRequired);
  const [user, setUser] = useState<SessionUser | null>(null);
  const isAuthenticated = Boolean(user);

  useEffect(() => {
    setupRequiredRef.current = setupRequired;
  }, [setupRequired]);

  const updateRoute = useCallback((nextRoute: string) => {
    if (routeRef.current === nextRoute) {
      return;
    }

    routeRef.current = nextRoute;
    setRouteState(nextRoute);
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      markCurrentHashHistoryEntry();
      updateRoute(getHashRoute());
    };
    const unsubscribeNavigation = subscribeHashRouteNavigation(updateRoute);

    window.addEventListener("hashchange", handleHashChange);
    handleHashChange();

    return () => {
      unsubscribeNavigation();
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, [updateRoute]);

  useEffect(() => {
    let isMounted = true;

    setIsCheckingSetup(true);
    setSetupError(null);
    getSetupStatus()
      .then((status) => {
        if (!isMounted) {
          return;
        }

        setSetupRequired(status.setupRequired);
        setSetupError(null);
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setSetupError(
            `Не удалось проверить состояние первоначальной настройки. ${error instanceof Error ? error.message : "Неизвестная ошибка."}`,
          );
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsCheckingSetup(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [setupCheckRevision]);

  useEffect(() => {
    return subscribeSessionExpired(() => {
      setUser(null);
      setIsCheckingSession(false);

      if (!setupRequiredRef.current && !isLoginRoute(routeRef.current)) {
        setHashRoute(LOGIN_ROUTE);
      }
    });
  }, []);

  useEffect(() => {
    let isMounted = true;

    getAuthenticatedUser()
      .then((sessionUser) => {
        if (isMounted) {
          setUser(sessionUser);
        }
      })
      .catch(() => {
        if (isMounted) {
          setUser(null);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsCheckingSession(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isCheckingSetup || setupError) {
      return;
    }

    if (setupRequired) {
      if (!isSetupRoute(route)) {
        setHashRoute(SETUP_ROUTE);
      }
      return;
    }

    if (isCheckingSession) {
      return;
    }

    if (isSetupRoute(route)) {
      setHashRoute(
        isAuthenticated ? getDefaultAuthRoute(user?.permissions) : LOGIN_ROUTE,
      );
      return;
    }

    if (isAuthenticated && isLoginRoute(route)) {
      setHashRoute(getDefaultAuthRoute(user?.permissions));
      return;
    }

    if (!isAuthenticated && !isLoginRoute(route)) {
      setHashRoute(LOGIN_ROUTE);
    }
    if (isAuthenticated && !canAccessWorkspaceRoute(user?.permissions, route)) {
      setHashRoute(getDefaultAuthRoute(user?.permissions));
    }
  }, [
    isAuthenticated,
    isCheckingSession,
    isCheckingSetup,
    route,
    setupError,
    setupRequired,
    user?.permissions,
  ]);

  const handleLogout = async () => {
    try {
      await authClient.signOut();
    } finally {
      setUser(null);
      setHashRoute(LOGIN_ROUTE);
    }
  };

  const handleAuthenticated = async () => {
    try {
      const sessionUser = await waitForAuthenticatedUser();

      setUser(sessionUser);
      setHashRoute(getDefaultAuthRoute(sessionUser?.permissions));
    } catch (error) {
      setUser(null);
      throw error;
    }
  };

  const refreshAuthenticatedUser = async () => {
    try {
      const sessionUser = await getAuthenticatedUser();

      setUser(sessionUser);
    } catch {
      // Refresh is a background update; keep the current session UI on failure.
    }
  };

  const handleSetupCompleted = useCallback(() => {
    setSetupRequired(false);
    setHashRoute(LOGIN_ROUTE);
  }, []);

  if (isCheckingSetup) {
    return (
      <main
        className="empty-page"
        aria-label="Проверка первоначальной настройки"
      >
        Проверка первоначальной настройки...
      </main>
    );
  }

  if (setupError) {
    return (
      <main
        className="empty-page"
        aria-label="Ошибка проверки первоначальной настройки"
      >
        <p role="alert">{setupError}</p>
        <button onClick={() => setSetupCheckRevision((value) => value + 1)}>
          Повторить проверку
        </button>
      </main>
    );
  }

  if (setupRequired) {
    return <SetupPage onCompleted={handleSetupCompleted} />;
  }

  if (isCheckingSession) {
    return <main className="empty-page" aria-label="Загрузка приложения" />;
  }

  if (isAuthenticated) {
    return (
      <AppShell
        onLogout={handleLogout}
        onUserRefresh={() => void refreshAuthenticatedUser()}
        route={route}
        user={user}
      />
    );
  }

  return <LoginPage onAuthenticated={handleAuthenticated} />;
}

export default App;
