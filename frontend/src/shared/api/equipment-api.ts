export type OptionItem = {
  id: number;
  name: string;
  position?: string;
};

export type EquipmentStatusOption = {
  label: string;
  value: string;
};

export type EquipmentCreateOptions = {
  countries: OptionItem[];
  employees: OptionItem[];
  manufacturers: OptionItem[];
  nextVisibleId: number;
  sections: OptionItem[];
  statuses: EquipmentStatusOption[];
};

export type CreateEquipmentPayload = {
  visibleId?: number;
  name: string;
  manufacturerId?: number | null;
  model?: string | null;
  specifications?: string | null;
  serialNumber?: string | null;
  inventoryNumber: string;
  countryId?: number | null;
  manufactureYear?: number | null;
  commissioningDate?: string | null;
  sectionId: number;
  responsibleEmployeeId: number;
  status: string;
  operationText?: string | null;
  notes?: string | null;
};

export type EquipmentRegistryItem = {
  id: number;
  inventoryNumber: string;
  manufacturer: string;
  model: string;
  name: string;
  serialNumber: string | null;
  status: string;
  statusLabel: string;
  visibleId: number;
};

const API_URL = import.meta.env.VITE_API_URL || '';

async function request<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    ...init,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.message ?? 'Не удалось выполнить запрос.');
  }

  return (await response.json()) as T;
}

export function getEquipmentCreateOptions() {
  return request<EquipmentCreateOptions>('/api/equipment/create-options');
}

export function getEquipmentRegistry() {
  return request<EquipmentRegistryItem[]>('/api/equipment');
}

export function createEquipment(payload: CreateEquipmentPayload) {
  return request('/api/equipment', {
    body: JSON.stringify(payload),
    method: 'POST',
  });
}
