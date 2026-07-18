import { useEffect, useState } from 'react';
import { AppShell } from './layouts/AppShell';
import { authClient } from './lib/auth-client';
import { DEFAULT_AUTH_ROUTE, LOGIN_ROUTE, getHashRoute, isLoginRoute, setHashRoute } from './lib/hash-router';
import { LoginPage } from './pages/LoginPage';
import {
  getAuthenticatedUser,
  waitForAuthenticatedUser,
  type SessionUser,
} from './shared/api/auth-session';
import { markCurrentHashHistoryEntry } from './shared/lib/hash-history-marker';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [route, setRoute] = useState(getHashRoute);
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
    if (isCheckingSession) {
      return;
    }

    if (isAuthenticated && isLoginRoute(route)) {
      setHashRoute(DEFAULT_AUTH_ROUTE);
      return;
    }

    if (!isAuthenticated && !isLoginRoute(route)) {
      setHashRoute(LOGIN_ROUTE);
    }
  }, [isAuthenticated, isCheckingSession, route]);

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
