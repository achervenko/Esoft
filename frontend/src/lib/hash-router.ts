export const LOGIN_ROUTE = '#/login';
export const DEFAULT_AUTH_ROUTE = '#/dashboard';

export function getHashRoute() {
  return window.location.hash || LOGIN_ROUTE;
}

export function setHashRoute(route: string) {
  if (window.location.hash !== route) {
    window.location.hash = route;
  }
}

export function isLoginRoute(route: string) {
  return route === LOGIN_ROUTE || route === '#login';
}
