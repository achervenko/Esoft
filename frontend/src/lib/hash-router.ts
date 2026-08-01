export const LOGIN_ROUTE = '#/login';
export const SETUP_ROUTE = '#/setup';
export const DEFAULT_AUTH_ROUTE = '#/dashboard';

const HASH_ROUTE_NAVIGATION_EVENT = 'esoft:hash-route-navigation';

export function normalizeHashRoute(route: string | null | undefined) {
  const cleanRoute = route?.trim() ?? '';

  if (!cleanRoute) {
    return LOGIN_ROUTE;
  }

  const routeWithoutHash = cleanRoute.startsWith('#')
    ? cleanRoute.slice(1)
    : cleanRoute;

  if (!routeWithoutHash) {
    return LOGIN_ROUTE;
  }

  return routeWithoutHash.startsWith('/')
    ? `#${routeWithoutHash}`
    : `#/${routeWithoutHash}`;
}

export function getHashRoute() {
  return normalizeHashRoute(window.location.hash);
}

export function setHashRoute(route: string) {
  const normalizedRoute = normalizeHashRoute(route);

  if (
    getHashRoute() !== normalizedRoute ||
    window.location.hash !== normalizedRoute
  ) {
    window.dispatchEvent(
      new CustomEvent(HASH_ROUTE_NAVIGATION_EVENT, {
        detail: { route: normalizedRoute },
      }),
    );
    window.location.hash = normalizedRoute;
  }
}

export function subscribeHashRouteNavigation(
  listener: (route: string) => void,
) {
  const handleNavigation = (event: Event) => {
    if (!(event instanceof CustomEvent)) {
      return;
    }

    const route = event.detail?.route;

    if (typeof route === 'string') {
      listener(normalizeHashRoute(route));
    }
  };

  window.addEventListener(HASH_ROUTE_NAVIGATION_EVENT, handleNavigation);

  return () => {
    window.removeEventListener(HASH_ROUTE_NAVIGATION_EVENT, handleNavigation);
  };
}

export function isLoginRoute(route: string) {
  return normalizeHashRoute(route) === LOGIN_ROUTE;
}

export function isSetupRoute(route: string) {
  return normalizeHashRoute(route) === SETUP_ROUTE;
}
