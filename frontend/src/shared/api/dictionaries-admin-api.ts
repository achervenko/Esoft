export type DictionariesAdminOverview = {
  dictionaries: Array<never>;
};

export type DictionaryManufacturer = {
  id: number;
  name: string;
};

export type DictionaryCountry = {
  id: number;
  iso: string;
  name: string;
};

export type DictionaryObject = {
  id: number;
  name: string;
};

export type DictionaryLocation = {
  id: number;
  name: string;
  workshop: DictionaryObject;
  workshopId: number;
};

export type DictionaryNamePayload = {
  name: string;
};

export type CountryPayload = {
  iso: string;
  name: string;
};

export type LocationPayload = {
  name: string;
  objectId: number;
};

const API_URL = import.meta.env.VITE_API_URL || "";

export class DictionariesAdminApiError extends Error {
  readonly code: string | null;
  readonly status: number;

  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.name = "DictionariesAdminApiError";
    this.code = code;
    this.status = status;
  }
}

export function getDictionariesAdminOverview() {
  return request<DictionariesAdminOverview>("/api/dictionaries/admin/overview");
}

export function getDictionaryManufacturers() {
  return request<DictionaryManufacturer[]>(
    "/api/dictionaries/admin/manufacturers",
  );
}

export function createDictionaryManufacturer(payload: DictionaryNamePayload) {
  return request<DictionaryManufacturer>(
    "/api/dictionaries/admin/manufacturers",
    {
      body: JSON.stringify(payload),
      method: "POST",
    },
  );
}

export function updateDictionaryManufacturer(
  id: number,
  payload: DictionaryNamePayload,
) {
  return request<DictionaryManufacturer>(
    `/api/dictionaries/admin/manufacturers/${id}`,
    {
      body: JSON.stringify(payload),
      method: "PUT",
    },
  );
}

export function deleteDictionaryManufacturer(id: number) {
  return request<{ ok: true }>(`/api/dictionaries/admin/manufacturers/${id}`, {
    method: "DELETE",
  });
}

export function getDictionaryCountries() {
  return request<DictionaryCountry[]>("/api/dictionaries/admin/countries");
}

export function createDictionaryCountry(payload: CountryPayload) {
  return request<DictionaryCountry>("/api/dictionaries/admin/countries", {
    body: JSON.stringify(payload),
    method: "POST",
  });
}

export function updateDictionaryCountry(id: number, payload: CountryPayload) {
  return request<DictionaryCountry>(`/api/dictionaries/admin/countries/${id}`, {
    body: JSON.stringify(payload),
    method: "PUT",
  });
}

export function deleteDictionaryCountry(id: number) {
  return request<{ ok: true }>(`/api/dictionaries/admin/countries/${id}`, {
    method: "DELETE",
  });
}

export function getDictionaryObjects() {
  return request<DictionaryObject[]>("/api/dictionaries/admin/objects");
}

export function createDictionaryObject(payload: DictionaryNamePayload) {
  return request<DictionaryObject>("/api/dictionaries/admin/objects", {
    body: JSON.stringify(payload),
    method: "POST",
  });
}

export function updateDictionaryObject(
  id: number,
  payload: DictionaryNamePayload,
) {
  return request<DictionaryObject>(`/api/dictionaries/admin/objects/${id}`, {
    body: JSON.stringify(payload),
    method: "PUT",
  });
}

export function deleteDictionaryObject(id: number) {
  return request<{ ok: true }>(`/api/dictionaries/admin/objects/${id}`, {
    method: "DELETE",
  });
}

export function getDictionaryLocations() {
  return request<DictionaryLocation[]>("/api/dictionaries/admin/locations");
}

export function createDictionaryLocation(payload: LocationPayload) {
  return request<DictionaryLocation>("/api/dictionaries/admin/locations", {
    body: JSON.stringify(payload),
    method: "POST",
  });
}

export function updateDictionaryLocation(id: number, payload: LocationPayload) {
  return request<DictionaryLocation>(
    `/api/dictionaries/admin/locations/${id}`,
    {
      body: JSON.stringify(payload),
      method: "PUT",
    },
  );
}

export function deleteDictionaryLocation(id: number) {
  return request<{ ok: true }>(`/api/dictionaries/admin/locations/${id}`, {
    method: "DELETE",
  });
}

async function request<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    ...init,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);

    throw new DictionariesAdminApiError(
      errorBody?.message ?? "Не удалось выполнить запрос.",
      response.status,
      typeof errorBody?.code === "string" ? errorBody.code : null,
    );
  }

  return (await response.json()) as T;
}
