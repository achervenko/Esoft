# Data Model

## Equipment

Основная сущность модуля.

### Поля

- `id` — внутренний технический идентификатор.
- `visibleId` — пользовательский номер оборудования.
- `inventoryNumber` — уникальный инвентарный номер.
- `serialNumber` — заводской номер, может отсутствовать.
- `name` — название оборудования.
- `modelId` — ссылка на модель оборудования.
- `specifications` — технические характеристики.
- `countryId` — страна производства, необязательная ссылка.
- `manufactureYear` — год выпуска.
- `commissioningDate` — дата ввода в эксплуатацию.
- `issueDate` — дата выдачи.
- `sectionId` — участок размещения оборудования.
- `responsibleEmployeeId` — ответственный сотрудник.
- `status` — текущее состояние оборудования.
- `operationText` — технологическая операция.
- `notes` — примечание.

### Связи

- `model -> EquipmentModel`
- `country -> Country?`
- `section -> Section`
- `responsibleEmployee -> Employee`
- `events -> EquipmentEvent[]`
- `checklists -> Checklist[]`

## Manufacturer

Справочник производителей.

### Поля

- `id`
- `name`

### Связи

- `models -> EquipmentModel[]`

## EquipmentModel

Справочник моделей оборудования.

### Поля

- `id`
- `name`
- `manufacturerId`

### Связи

- `manufacturer -> Manufacturer`
- `equipment -> Equipment[]`
- `maintenanceSettings -> EquipmentMaintenanceSetting[]`

### Особенность

Производитель оборудования выводится через модель. В самой сущности `Equipment` поля производителя нет.

## Employee

В контексте модуля используется как ответственный сотрудник.

### Используемые поля

- `id`
- `lastName`
- `firstName`
- `middleName`
- `position`
- `isActive`

### Роль в модуле

- назначается ответственным за оборудование;
- используется в карточке, истории и поисковом индексе;
- должен быть активным для создания и изменения оборудования.

## Country

Справочник стран производства.

### Поля

- `id`
- `name`
- `iso`

### Связи

- `equipment -> Equipment[]`

## Workshop и Section

Размещение оборудования моделируется через связку цеха и участка.

### Workshop

- `id`
- `name`

### Section

- `id`
- `workshopId`
- `name`

### Использование в Equipment

Оборудование хранит `sectionId`, а человекочитаемое местоположение собирается как:

`workshop.name / section.name`

## Производные DTO

Модуль использует два основных представления оборудования:

- элемент реестра — компактный DTO для списка;
- карточка оборудования — полное DTO для просмотра и редактирования.

Оба представления формируются presenter-слоем, а не возвращаются напрямую из Prisma.
