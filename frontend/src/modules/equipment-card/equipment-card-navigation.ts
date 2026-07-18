export function navigateWithViewTransition(hashRoute: string) {
  if (window.location.hash === hashRoute) {
    return;
  }

  if (!document.startViewTransition) {
    window.location.hash = hashRoute;
    return;
  }

  try {
    document.startViewTransition(() => {
      window.location.hash = hashRoute;
    });
  } catch {
    window.location.hash = hashRoute;
  }
}
