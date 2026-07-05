import { useEffect, useState } from 'react';
import { AppShell } from './layouts/AppShell';
import { authClient } from './lib/auth-client';
import { DEFAULT_AUTH_ROUTE, LOGIN_ROUTE, getHashRoute, isLoginRoute, setHashRoute } from './lib/hash-router';
import { LoginPage } from './pages/LoginPage';

type SessionUser = {
  displayUsername?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  name?: string | null;
  role?: string | null;
  username?: string | null;
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [route, setRoute] = useState(getHashRoute);
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    const handleHashChange = () => setRoute(getHashRoute());

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    let isMounted = true;

    authClient
      .getSession()
      .then((response) => {
        if (isMounted) {
          setIsAuthenticated(Boolean(response.data?.session));
          setUser((response.data?.user ?? null) as SessionUser | null);
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

  const refreshSession = async () => {
    const response = await authClient.getSession();
    const sessionUser = (response.data?.user ?? null) as SessionUser | null;

    setIsAuthenticated(Boolean(response.data?.session));
    setUser(sessionUser);

    return sessionUser;
  };

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
    await refreshSession();
    setHashRoute(DEFAULT_AUTH_ROUTE);
  };

  if (isCheckingSession) {
    return <main className="empty-page" aria-label="Загрузка приложения" />;
  }

  if (isAuthenticated) {
    return <AppShell onLogout={handleLogout} route={route} user={user} />;
  }

  return <LoginPage onAuthenticated={handleAuthenticated} />;
}

export default App;
