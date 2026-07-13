export function buildHashRoute(
  path: string,
  params: Record<string, string | null | undefined>,
) {
  const queryStartIndex = path.indexOf("?");
  const basePath =
    queryStartIndex === -1 ? path : path.slice(0, queryStartIndex);
  const searchParams = new URLSearchParams(
    queryStartIndex === -1 ? "" : path.slice(queryStartIndex + 1),
  );

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      searchParams.set(key, value);
    }
  });

  const query = searchParams.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function getHashRouteParam(route: string, name: string) {
  const queryStartIndex = route.indexOf("?");

  if (queryStartIndex === -1) {
    return null;
  }

  return new URLSearchParams(route.slice(queryStartIndex + 1)).get(name);
}

export function getSafeReturnTo(route: string | null | undefined) {
  if (!route || !route.startsWith("#/")) {
    return "#/equipment";
  }

  return route;
}
