# Типы данных

## EquipmentViewTab

Файл:

- `equipment-card-tabs.ts`

Тип:

```ts
type EquipmentViewTab =
  | "details"
  | "documents"
  | "events"
  | "history"
  | "maintenance-settings";
```

Назначение:

- фиксированный список вкладок карточки

## EquipmentCard

Файл:

- `shared/api/equipment/equipment.types.ts`

Назначение:

- полное представление оборудования для карточки

Ключевые поля:

- `visibleId`
- `name`
- `manufacturer`
- `model`
- `serialNumber`
- `inventoryNumber`
- `country`
- `manufactureYear`
- `commissioningDate`
- `issueDate`
- `location`
- `responsible`
- `responsiblePosition`
- `specifications`
- `operationText`
- `notes`
- `status`
- `statusLabel`

## EquipmentHistoryItem

Файл:

- `shared/api/equipment/equipment.types.ts`

Назначение:

- одна запись истории изменений оборудования

Ключевые поля:

- `id`
- `action`
- `createdAt`
- `fieldName`
- `oldValue`
- `newValue`
- `user`
- `timeZone`

## EquipmentFile

Файл:

- `shared/api/equipment-files/equipment-files.types.ts`

Назначение:

- единый тип файла оборудования

В модуле карточки используется и для фотографий, и как источник данных для preview.

Ключевые поля:

- `id`
- `displayName`
- `documentType`
- `isPrimary`
- `mimeType`
- `originalName`

## EquipmentCardField

Файл:

- `equipment-card-view-model.tsx`

Тип:

```ts
type EquipmentCardField = {
  label: string;
  value: ReactNode;
};
```

Назначение:

- элемент grid карточки

## EquipmentCardSection

Файл:

- `equipment-card-view-model.tsx`

Назначение:

- одна логическая секция карточки со списком полей

## EquipmentCardTextBlock

Файл:

- `equipment-card-view-model.tsx`

Назначение:

- один текстовый блок секции `Описание`

## EquipmentPhoto

Отдельного типа `EquipmentPhoto` в коде нет.

Текущая реализация рассматривает фотографии как:

- `EquipmentFile` с `documentType === "equipment_photo"`
