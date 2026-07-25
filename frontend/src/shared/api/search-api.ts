import { request } from "./api-client";

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

  return request<SearchResultItem[]>(`/api/search?${searchParams}`);
}
