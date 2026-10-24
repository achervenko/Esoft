import { useEffect, useMemo, useState } from "react";
import { searchApp } from "../../shared/api/search-api";
import { getApiErrorMessage } from "../../shared/api/api-error";
import type { AdminEmployee } from "../../shared/api/users-admin-api";

const normalize = (value: string) =>
  value.trim().toLocaleLowerCase("ru").replace(/ё/g, "е").replace(/\s+/g, " ");

export function useEmployeeDictionarySearch(
  employees: AdminEmployee[],
  query: string,
) {
  const searchIndex = useMemo(
    () =>
      employees.map((employee) => ({
        employee,
        text: normalize(
          [
            employee.fullName,
            employee.position,
            ...(employee.additionalPositions ?? []).map(({ name }) => name),
          ].join(" "),
        ),
      })),
    [employees],
  );
  const normalized = normalize(query);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    query: string;
    ids: Set<number>;
    error: string | null;
    limited: boolean;
  }>({ query: "", ids: new Set(), error: null, limited: false });
  const [loading, setLoading] = useState(false);
  const ready = normalized.length >= 2;

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(() => {
      searchApp({
        query: normalized,
        entityType: "employee",
        limit: 100,
        signal: controller.signal,
      })
        .then((items) => {
          if (!controller.signal.aborted)
            setResult({
              query: normalized,
              ids: new Set(
                items
                  .filter((item) => item.entityType === "employee")
                  .map((item) => item.entityId),
              ),
              error: null,
              limited: items.length === 100,
            });
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted)
            setResult({
              query: normalized,
              ids: new Set(),
              error: getApiErrorMessage(error, "Не удалось выполнить поиск."),
              limited: false,
            });
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 150);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [normalized, ready, attempt]);

  const current = ready && result.query === normalized;
  const words = normalized.split(" ").filter(Boolean);
  const filtered = searchIndex
    .filter(
      ({ employee, text }) =>
        words.every((word) => text.includes(word)) ||
        (current && result.ids.has(employee.id)),
    )
    .map(({ employee }) => employee);
  return {
    filtered,
    isSearching: ready && (!current || loading),
    error: current ? result.error : null,
    limited: current && result.limited,
    retry: () => setAttempt((value) => value + 1),
  };
}
