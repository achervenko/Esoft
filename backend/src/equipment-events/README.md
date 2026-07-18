# Equipment Events API

API модуля событий оборудования включает три связанные части:

- события оборудования;
- настройки обслуживания моделей оборудования;
- справочник видов обслуживания.

## Доступ

- Просмотр событий и настроек: любой авторизованный пользователь.
- Создание, изменение и отмена событий: `admin`, `chief_engineer`.
- Запуск и завершение события: только назначенный ответственный пользователь этого события.
- Изменение настроек обслуживания: `admin`, `chief_engineer`.
- Управление справочником видов обслуживания: `admin`.

## Статусы событий

- `CREATED` — событие создано и ожидает начала работ.
- `IN_PROGRESS` — событие взято в работу.
- `COMPLETED` — событие завершено.
- `CANCELLED` — событие отменено.

Переходы:

```text
CREATED     -> IN_PROGRESS
CREATED     -> CANCELLED
IN_PROGRESS -> COMPLETED
IN_PROGRESS -> CANCELLED
```

`COMPLETED` и `CANCELLED` терминальные.

## Модель чек-листов события

Текущая модель фиксирована:

- у события должен быть хотя бы один ответственный;
- при создании события frontend обязан передать полный массив `checklistAssignments`;
- каждый элемент `checklistAssignments` означает назначение одного шаблона одному ответственному;
- внутри одного события у ответственного может быть только один чек-лист;
- один и тот же шаблон можно назначить нескольким ответственным;
- экземпляры `Checklist` и `ChecklistDetail` создаются сразу при создании события;
- `Checklist.isRequired` удалён из модели и больше не участвует в API;
- шаблон по умолчанию из maintenance setting используется только для предзаполнения формы и не ограничивает create/update события на backend.

Формат назначения:

```json
{
  "assignedUserId": "user-id-1",
  "checklistTemplateId": 12
}
```

## GET /api/equipment-events

Возвращает список событий.

Query:

```text
equipmentVisibleId?: number
maintenanceTypeId?: number
status?: CREATED | IN_PROGRESS | COMPLETED | CANCELLED
responsibleUserId?: string
dateFrom?: YYYY-MM-DD
dateTo?: YYYY-MM-DD
limit?: number = 20, max 100
offset?: number = 0
```

`dateFrom` и `dateTo` фильтруют `factDate`.

Сортировка:

```text
factDate DESC NULLS LAST
plannedDate DESC NULLS LAST
createdAt DESC
id DESC
```

Элемент ответа:

```json
{
  "id": 101,
  "source": "MANUAL",
  "status": "CREATED",
  "version": 1,
  "maintenanceSettingId": 10,
  "executionType": "INTERNAL",
  "plannedDate": "2026-07-22",
  "factDate": null,
  "note": "Внеплановая диагностика после вибрации",
  "equipment": {
    "id": 5,
    "visibleId": 125,
    "name": "Компрессор №2",
    "model": {
      "id": 3,
      "name": "К-500"
    }
  },
  "maintenanceType": {
    "id": 2,
    "name": "Техническое обслуживание",
    "code": "TO"
  },
  "responsibles": [
    {
      "id": "user-id-1",
      "fullName": "Иванов Иван Иванович",
      "position": "Механик",
      "role": "user"
    }
  ],
  "checklists": [
    {
      "id": 501,
      "checklistTemplateId": 12,
      "assignedUserId": "user-id-1",
      "status": "CREATED",
      "sortOrder": 1
    }
  ]
}
```

## GET /api/equipment-events/:id

Возвращает карточку события.

Дополнительно к полям списка ответ содержит:

```text
originalPlannedDate
createdAt
createdBy
equipment.model.manufacturer
```

`checklists[]` в detail-ответе содержит:

```text
id
checklistTemplateId
assignedUserId
status
sortOrder
```

## GET /api/equipment-events/responsible-users

Возвращает активных пользователей, связанных с сотрудниками.

Доступ: `admin`, `chief_engineer`.

Ответ:

```json
{
  "users": [
    {
      "userId": "user-id-1",
      "fullName": "Иванов Иван Иванович",
      "position": "Механик",
      "role": "user"
    }
  ]
}
```

## POST /api/equipment/:visibleId/events/manual

Создаёт ручное событие внутри карточки оборудования.

Body:

```json
{
  "maintenanceTypeId": 1,
  "plannedDate": "2026-07-22",
  "note": "Внеплановая диагностика после вибрации",
  "responsibleUserIds": ["user-id-1", "user-id-2"],
  "checklistAssignments": [
    {
      "assignedUserId": "user-id-1",
      "checklistTemplateId": 12
    },
    {
      "assignedUserId": "user-id-2",
      "checklistTemplateId": 12
    }
  ]
}
```

Правила:

- `plannedDate` обязательна;
- `factDate` при создании не передаётся и сохраняется как `null`;
- после дедупликации `responsibleUserIds` должен остаться хотя бы один ответственный;
- ответственные должны существовать, быть привязаны к сотрудникам и не быть отключёнными;
- вид обслуживания должен существовать и быть активным;
- для модели оборудования должна существовать настройка этого вида обслуживания;
- `maintenanceSettingId` сохраняется как ссылка на настройку, а `executionType` копируется снимком в событие;
- `checklistAssignments` обязателен и трактуется как полное итоговое состояние назначений;
- назначение должно быть ровно одно на каждого ответственного;
- каждый `assignedUserId` должен входить в итоговый набор ответственных;
- один и тот же `checklistTemplateId` можно использовать в нескольких назначениях;
- все выбранные шаблоны должны существовать, быть активными и опубликованными в момент создания;
- событие, ответственные, чек-листы и `ChecklistDetail` создаются одной транзакцией.

При создании backend сразу создаёт по одному экземпляру `Checklist` на каждого ответственного и копирует структуру шаблона в `checklist_details`.

## PATCH /api/equipment-events/:id

Изменяет событие только в статусе `CREATED`.

Body:

```json
{
  "version": 1,
  "plannedDate": "2026-07-23",
  "note": "Комментарий уточнён",
  "responsibleUserIds": ["user-id-1", "user-id-2"],
  "checklistAssignments": [
    {
      "assignedUserId": "user-id-1",
      "checklistTemplateId": 18
    },
    {
      "assignedUserId": "user-id-2",
      "checklistTemplateId": 12
    }
  ]
}
```

Допустимые поля DTO:

```text
equipmentVisibleId?: number
maintenanceTypeId?: number
plannedDate?: YYYY-MM-DD
note?: string | null
responsibleUserIds?: string[]
checklistAssignments?: { assignedUserId, checklistTemplateId }[]
version: number
```

Правила:

- `version` обязателен для optimistic locking;
- если передан `responsibleUserIds`, backend нормализует его через `Set`;
- если `responsibleUserIds` не передан, для проверки `checklistAssignments` используется текущий набор ответственных события;
- если меняется состав множества `responsibleUserIds`, `checklistAssignments` обязателен и должен описывать полный итоговый набор;
- если меняется `equipmentVisibleId` или `maintenanceTypeId`, `checklistAssignments` тоже обязателен;
- если передан `checklistAssignments`, все указанные шаблоны проверяются на активность, даже если часть назначений визуально не изменилась;
- PATCH может менять только шаблон у существующего ответственного без изменения состава ответственных;
- событие без фактических изменений не обновляется;
- при смене оборудования весь набор экземпляров чек-листов пересоздаётся;
- при неизменённом оборудовании синхронизация идёт дифференциально по `assignedUserId`;
- неизменённые назначения сохраняют существующие `Checklist.id`;
- порядок `sortOrder` определяется порядком входного массива `checklistAssignments`.

## POST /api/equipment-events/:id/start

Переводит событие из `CREATED` в `IN_PROGRESS`.

Доступ: только назначенный ответственный.

Проверки перед стартом:

- событие существует;
- событие находится в статусе `CREATED`;
- у события есть хотя бы один ответственный;
- у события есть хотя бы один чек-лист;
- множество `assignedUserId` в чек-листах точно совпадает с множеством ответственных;
- у каждого ответственного ровно один чек-лист;
- все чек-листы события находятся в статусе `CREATED`.

## POST /api/equipment-events/:id/complete

Завершает событие из статуса `IN_PROGRESS`.

Доступ: только назначенный ответственный.

Body:

```json
{
  "factDate": "2026-07-22"
}
```

`factDate` можно не передавать только если она уже сохранена в событии. Если даты нет ни в payload, ни в событии, backend вернёт ошибку.

Проверки:

- событие существует;
- событие находится в статусе `IN_PROGRESS`;
- у события есть хотя бы один ответственный;
- завершает один из назначенных ответственных;
- у события есть хотя бы один чек-лист;
- все чек-листы события имеют статус `COMPLETED`.

Backend не отменяет никакие чек-листы автоматически: для завершения события должны быть завершены все.

## POST /api/equipment-events/:id/cancel

Отменяет событие из статусов `CREATED` или `IN_PROGRESS`.

Доступ: `admin`, `chief_engineer`.

При отмене:

- событие блокируется в транзакции;
- активные чек-листы события блокируются и переводятся через сервис завершения чек-листов;
- статус события меняется на `CANCELLED`.

## Maintenance settings

Настройки обслуживания существуют на уровне модели оборудования.

Текущая модель:

- одна настройка соответствует одной паре `equipmentModel + maintenanceType`;
- настройка содержит один необязательный `defaultChecklistTemplateId`;
- default-шаблон нужен только для UX-предзаполнения форм событий;
- настройка может существовать без default-шаблона;
- архивный шаблон может оставаться привязанным к уже существующей настройке;
- при create и при явной смене `defaultChecklistTemplateId` backend разрешает только активный и опубликованный шаблон;
- update только `periodicity` или `executionType` не должен падать из-за уже архивированного default.

### GET /api/equipment/:visibleId/maintenance-settings

Возвращает настройки для модели выбранного оборудования.

Ответ:

```json
{
  "affectedEquipmentCount": 4,
  "equipment": {
    "visibleId": 125,
    "name": "Компрессор №2"
  },
  "settings": [
    {
      "id": 10,
      "executionType": "INTERNAL",
      "maintenanceType": {
        "id": 2,
        "name": "Техническое обслуживание",
        "isActive": true
      },
      "defaultChecklistTemplate": {
        "checklistTemplateId": 12,
        "name": "Ежемесячный осмотр",
        "state": "ACTIVE"
      },
      "periodicity": {
        "years": 0,
        "months": 1,
        "weeks": 0,
        "days": 0
      }
    }
  ]
}
```

Поле `defaultChecklistTemplate` интерпретируется так:

- `null` — шаблон по умолчанию не назначен;
- объект с `state: "ACTIVE"` — назначен активный шаблон;
- объект с `state: "ARCHIVED"` — ссылка сохранена, но шаблон архивирован.

### GET /api/equipment/:visibleId/maintenance-settings/available-types

Возвращает активные виды обслуживания, которые ещё не настроены для модели оборудования.

Ответ:

```json
{
  "maintenanceTypes": [
    {
      "id": 2,
      "name": "Техническое обслуживание"
    }
  ]
}
```

### POST /api/equipment/:visibleId/maintenance-settings

Создаёт настройку обслуживания.

Body:

```json
{
  "maintenanceTypeId": 2,
  "executionType": "INTERNAL",
  "defaultChecklistTemplateId": 12,
  "periodicity": {
    "years": 0,
    "months": 1,
    "weeks": 0,
    "days": 0
  }
}
```

`defaultChecklistTemplateId` можно опустить или передать как `null`.

Правила:

- `maintenanceTypeId` обязателен;
- вид обслуживания должен существовать и быть активным;
- настройка для пары `equipmentModel + maintenanceType` должна отсутствовать;
- если `defaultChecklistTemplateId` передан и не равен `null`, шаблон должен существовать, быть активным и опубликованным;
- `periodicity` может быть `null`.

### PATCH /api/equipment/:visibleId/maintenance-settings/:settingId

Обновляет существующую настройку.

Body:

```json
{
  "defaultChecklistTemplateId": null,
  "executionType": "EXTERNAL"
}
```

Разрешено изменять:

```text
defaultChecklistTemplateId?: number | null
executionType?: INTERNAL | EXTERNAL
periodicity?: { years, months, weeks, days } | null
```

Правила:

- `maintenanceTypeId` через PATCH менять нельзя;
- update без полей запрещён;
- если передан новый `defaultChecklistTemplateId`, он должен указывать на активный и опубликованный шаблон;
- `defaultChecklistTemplateId: null` очищает default-шаблон;
- если default-шаблон уже архивирован, update только `executionType` или `periodicity` остаётся допустимым.

### DELETE /api/equipment/:visibleId/maintenance-settings/:settingId

Удаляет настройку обслуживания.

## Maintenance types

Справочник видов обслуживания живёт отдельно от событий и настроек.

### GET /api/maintenance-types

Возвращает список видов обслуживания.

Query:

```text
includeInactive?: boolean
```

Правила:

- без `includeInactive` возвращаются только активные виды;
- `includeInactive=true` доступен только `admin`.

Ответ:

```json
{
  "maintenanceTypes": [
    {
      "id": 2,
      "name": "Техническое обслуживание",
      "code": "TO",
      "isActive": true
    }
  ]
}
```

### POST /api/maintenance-types

Создаёт вид обслуживания.

Body:

```json
{
  "name": "Техническое обслуживание",
  "code": "TO"
}
```

Правила:

- `name` обязателен, максимум 64 символа;
- `code` обязателен, максимум 32 символа;
- `code` нормализуется в uppercase;
- `code` должен начинаться с латинской буквы и содержать только `A-Z`, `0-9`, `_`.

### PATCH /api/maintenance-types/:id

Изменяет только `name`.

### POST /api/maintenance-types/:id/activate

Активирует вид обслуживания.

### POST /api/maintenance-types/:id/deactivate

Деактивирует вид обслуживания.

## Основные коды ошибок

### События оборудования

- `CHECKLISTS_NOT_COMPLETED` — не все чек-листы события завершены.
- `CHECKLISTS_REQUIRED` — у события нет ни одного чек-листа.
- `CHECKLIST_ASSIGNED_USER_INVALID` — некорректный `assignedUserId` в назначении.
- `CHECKLIST_ASSIGNED_USER_NOT_RESPONSIBLE` — исполнитель чек-листа не входит в итоговый набор ответственных.
- `CHECKLIST_ASSIGNEE_DUPLICATE` — одному ответственному назначено больше одного чек-листа.
- `CHECKLIST_ASSIGNMENTS_INVALID` — `checklistAssignments` не является массивом.
- `CHECKLIST_ASSIGNMENTS_REQUIRED` — назначения не покрывают всех ответственных или обязательный полный массив не передан.
- `CHECKLIST_ASSIGNMENT_INVALID` — элемент `checklistAssignments` имеет некорректную структуру.
- `CHECKLIST_ASSIGNMENT_TEMPLATE_INVALID` — backend не смог синхронизировать итоговый набор чек-листов.
- `CHECKLIST_SORT_ORDER_DUPLICATE` — временные `sortOrder` при пересоздании чек-листов повторяются.
- `CHECKLIST_SORT_ORDER_INVALID` — временные `sortOrder` не заданы полностью или имеют некорректный формат.
- `CHECKLIST_STATUS_CONFLICT` — перед стартом не все чек-листы находятся в статусе `CREATED`.
- `CHECKLIST_TEMPLATE_INACTIVE` — выбранный шаблон чек-листа неактивен или не опубликован.
- `CHECKLIST_TEMPLATE_INVALID` — некорректный `checklistTemplateId`.
- `DATE_FROM_INVALID`, `DATE_TO_INVALID`, `DATE_RANGE_INVALID` — ошибки фильтрации списка по датам.
- `EQUIPMENT_INVALID`, `EQUIPMENT_NOT_FOUND` — некорректное или отсутствующее оборудование.
- `EVENT_NOT_FOUND` — событие не найдено.
- `EVENT_RESPONSIBLE_REQUIRED` — действие пытается выполнить пользователь, который не назначен ответственным.
- `EVENT_STATUS_CONFLICT` — переход статуса или изменение недопустимы в текущем состоянии.
- `EVENT_VERSION_CONFLICT` — optimistic lock не совпал.
- `FACT_DATE_IN_FUTURE`, `FACT_DATE_INVALID`, `FACT_DATE_REQUIRED` — ошибки фактической даты.
- `LIMIT_INVALID`, `OFFSET_INVALID`, `STATUS_INVALID` — ошибки query-параметров списка.
- `MAINTENANCE_SETTING_NOT_FOUND` — для выбранного оборудования и вида обслуживания нет настройки.
- `MAINTENANCE_TYPE_INACTIVE`, `MAINTENANCE_TYPE_INVALID`, `MAINTENANCE_TYPE_NOT_FOUND`, `MAINTENANCE_TYPE_REQUIRED` — ошибки вида обслуживания.
- `NOTE_INVALID` — некорректный комментарий.
- `PLANNED_DATE_INVALID`, `PLANNED_DATE_REQUIRED` — ошибки плановой даты.
- `RESPONSIBLES_REQUIRED` — итоговый набор ответственных пуст.
- `RESPONSIBLE_INVALID` — некорректный идентификатор ответственного.
- `RESPONSIBLE_NOT_FOUND` — один или несколько ответственных не найдены.
- `RESPONSIBLE_USER_INACTIVE` — один или несколько ответственных отключены.
- `SESSION_REQUIRED` — отсутствует пользовательская сессия для действия.
- `UPDATE_EMPTY` — PATCH не содержит изменяемых полей.
- `USER_EMPLOYEE_NOT_FOUND` — к учётной записи не привязан сотрудник.
- `VERSION_REQUIRED` — не передана версия события для PATCH.

### Настройки обслуживания

- `CHECKLIST_TEMPLATE_INACTIVE` — для default выбран неактивный или неопубликованный шаблон.
- `CHECKLIST_TEMPLATE_NOT_FOUND` — шаблон чек-листа не найден.
- `DEFAULT_CHECKLIST_TEMPLATE_REQUIRED` — `defaultChecklistTemplateId` передан в некорректном формате.
- `EQUIPMENT_NOT_FOUND` — оборудование не найдено.
- `EXECUTION_TYPE_INVALID` — некорректный способ выполнения.
- `MAINTENANCE_SETTING_ALREADY_EXISTS` — настройка для модели и вида обслуживания уже существует.
- `MAINTENANCE_SETTING_NOT_FOUND` — настройка не найдена.
- `MAINTENANCE_SETTING_UPDATE_EMPTY` — PATCH не содержит изменяемых полей.
- `MAINTENANCE_TYPE_INACTIVE` — выбранный вид обслуживания отключён.
- `MAINTENANCE_TYPE_INVALID` — попытка передать недопустимый `maintenanceTypeId`, в том числе в PATCH.
- `MAINTENANCE_TYPE_NOT_FOUND` — вид обслуживания не найден.
- `MAINTENANCE_TYPE_REQUIRED` — при создании не передан вид обслуживания.
- `PERIODICITY_FORMAT_CONFLICT` — прислан устаревший flat-формат periodicity.
- `PERIODICITY_INVALID` — объект periodicity отсутствует или содержит неизвестные поля.
- `PERIODICITY_VALUE_INVALID` — periodicity содержит нечисловые, отрицательные или полностью нулевые значения.
- `REQUEST_BODY_REQUIRED` — не передано тело запроса.

### Справочник видов обслуживания

- `INCLUDE_INACTIVE_INVALID` — некорректный query-параметр `includeInactive`.
- `MAINTENANCE_TYPE_ALREADY_ACTIVE` — вид уже активен.
- `MAINTENANCE_TYPE_ALREADY_INACTIVE` — вид уже отключён.
- `MAINTENANCE_TYPE_CODE_ALREADY_EXISTS` — код уже используется.
- `MAINTENANCE_TYPE_CODE_INVALID` — код не соответствует формату.
- `MAINTENANCE_TYPE_CODE_REQUIRED` — код не передан.
- `MAINTENANCE_TYPE_CODE_TOO_LONG` — код слишком длинный.
- `MAINTENANCE_TYPE_NAME_ALREADY_EXISTS` — название уже используется.
- `MAINTENANCE_TYPE_NAME_REQUIRED` — название не передано.
- `MAINTENANCE_TYPE_NAME_TOO_LONG` — название слишком длинное.
- `MAINTENANCE_TYPE_NOT_FOUND` — вид обслуживания не найден.
- `REQUEST_BODY_REQUIRED` — не передано тело запроса.
