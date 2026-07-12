export type SearchResultItem = {
  details: {
    location: string | null;
    manufacturer: string | null;
    model: string | null;
    responsible: string | null;
    serialNumber: string | null;
    status: string | null;
  };
  entityId: number;
  entityType: string;
  id: string;
  score: number;
  subtitle: string | null;
  targetUrl: string | null;
  title: string;
};

const API_URL = import.meta.env.VITE_API_URL || "";

export class SearchApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SearchApiError";
    this.status = status;
  }
}

export async function searchApp(params: {
  entityType?: string;
  limit?: number;
  offset?: number;
  query: string;
}) {
  const searchParams = new URLSearchParams();
  searchParams.set("q", params.query);

  if (params.entityType) {
    searchParams.set("entityType", params.entityType);
  }

  if (params.limit !== undefined) {
    searchParams.set("limit", String(params.limit));
  }

  if (params.offset !== undefined) {
    searchParams.set("offset", String(params.offset));
  }

  const response = await fetch(`${API_URL}/api/search?${searchParams}`, {
    credentials: "include",
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new SearchApiError(
      errorBody?.message ?? "Не удалось выполнить поиск.",
      response.status,
    );
  }

  return (await response.json()) as SearchResultItem[];
}
