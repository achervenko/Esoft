import { useCallback, useEffect, useState } from 'react';
import { AppShell } from './layouts/AppShell';
import { authClient } from './lib/auth-client';
import { DEFAULT_AUTH_ROUTE, LOGIN_ROUTE, SETUP_ROUTE, getHashRoute, isLoginRoute, isSetupRoute, setHashRoute } from './lib/hash-router';
import { LoginPage } from './pages/LoginPage';
import { SetupPage } from './pages/SetupPage';
import {
  getAuthenticatedUser,
  waitForAuthenticatedUser,
  type SessionUser,
} from './shared/api/auth-session';
import { getSetupStatus } from './shared/api/setup';
import { markCurrentHashHistoryEntry } from './shared/lib/hash-history-marker';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isCheckingSetup, setIsCheckingSetup] = useState(true);
  const [route, setRoute] = useState(getHashRoute);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    const handleHashChange = () => {
      markCurrentHashHistoryEntry();
      setRoute(getHashRoute());
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    let isMounted = true;

    getSetupStatus()
      .then((status) => {
        if (!isMounted) {
          return;
        }

        setSetupRequired(status.setupRequired);
        setSetupError(null);
      })
      .catch(() => {
        if (isMounted) {
          setSetupError(
            'Не удалось проверить состояние первоначальной настройки.',
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
  }, []);

  useEffect(() => {
    let isMounted = true;

    getAuthenticatedUser()
      .then((sessionUser) => {
        if (isMounted) {
          setIsAuthenticated(Boolean(sessionUser));
          setUser(sessionUser);
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsAuthenticated(false);
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
      setHashRoute(isAuthenticated ? DEFAULT_AUTH_ROUTE : LOGIN_ROUTE);
      return;
    }

    if (isAuthenticated && isLoginRoute(route)) {
      setHashRoute(DEFAULT_AUTH_ROUTE);
      return;
    }

    if (!isAuthenticated && !isLoginRoute(route)) {
      setHashRoute(LOGIN_ROUTE);
    }
  }, [
    isAuthenticated,
    isCheckingSession,
    isCheckingSetup,
    route,
    setupError,
    setupRequired,
  ]);

  const handleLogout = async () => {
    await authClient.signOut();
    setIsAuthenticated(false);
    setUser(null);
    setHashRoute(LOGIN_ROUTE);
  };

  const handleAuthenticated = async () => {
    const sessionUser = await waitForAuthenticatedUser();

    setIsAuthenticated(true);
    setUser(sessionUser);
    setHashRoute(DEFAULT_AUTH_ROUTE);
  };

  const refreshAuthenticatedUser = async () => {
    const sessionUser = await getAuthenticatedUser();
    setUser(sessionUser);
    setIsAuthenticated(Boolean(sessionUser));
  };

  const handleSetupCompleted = useCallback(() => {
    setSetupRequired(false);
    setHashRoute(LOGIN_ROUTE);
  }, []);

  if (isCheckingSetup) {
    return (
      <main className="empty-page" aria-label="Проверка первоначальной настройки">
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
        {setupError}
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
