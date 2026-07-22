import type {
  EquipmentCard,
  EquipmentHistoryItem,
} from "../../shared/api/equipment/equipment.types";
import type { EquipmentFile } from "../../shared/api/equipment-files/equipment-files.types";

export function createEquipmentCard(
  overrides: Partial<EquipmentCard> = {},
): EquipmentCard {
  return {
    commissioningDate: "2024-01-15",
    country: "Россия",
    countryId: 1,
    id: 101,
    inventoryNumber: "INV-001",
    issueDate: "2024-02-01",
    location: "Цех 1 / Участок 3",
    manufacturer: "DMG MORI",
    manufactureYear: 2023,
    model: "CTX 310",
    modelId: 9,
    name: "Токарный станок",
    notes: "Примечание",
    operationText: "Токарная обработка",
    responsible: "Иванов Иван Иванович",
    responsibleEmployeeId: 7,
    responsiblePosition: "Мастер",
    sectionId: 3,
    serialNumber: "SN-001",
    specifications: "Мощность 5 кВт",
    status: "ACTIVE",
    statusLabel: "В работе",
    visibleId: 42,
    ...overrides,
  };
}

export function createEquipmentHistoryItem(
  overrides: Partial<EquipmentHistoryItem> = {},
): EquipmentHistoryItem {
  return {
    action: "UPDATE",
    createdAt: "2026-07-22T09:30:00.000Z",
    fieldName: "Статус",
    id: 1,
    newValue: "В работе",
    oldValue: "Резерв",
    timeZone: "Europe/Moscow",
    user: "Иван Петров",
    ...overrides,
  };
}

export function createEquipmentPhoto(
  overrides: Partial<EquipmentFile> = {},
): EquipmentFile {
  return {
    createdAt: "2026-07-21T12:00:00.000Z",
    deletedAt: null,
    displayName: "Фото 1.jpg",
    documentType: "equipment_photo",
    id: 10,
    isPrimary: false,
    mimeType: "image/jpeg",
    originalName: "Фото 1.jpg",
    sizeBytes: "1024",
    ...overrides,
  };
}
