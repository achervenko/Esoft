# Equipment Events API

Backend-only модуль событий оборудования.

## Доступ

- Просмотр: любой авторизованный пользователь.
- Создание, изменение, выполнение и отмена: `admin`, `chief_engineer`.

## Статусы

- `DRAFT` — ручное событие находится в работе и может редактироваться до завершения или отмены.
- `CREATED` — плановое событие для будущего `PlanningModule`.
- `COMPLETED` — событие выполнено.
- `CANCELLED` — событие отменено.

Разрешённые переходы:

```text
DRAFT   -> COMPLETED
DRAFT   -> CANCELLED
CREATED -> COMPLETED
CREATED -> CANCELLED
```

`COMPLETED` и `CANCELLED` — терминальные статусы.

## GET /api/equipment-events

Возвращает список событий.

Query:

```text
equipmentVisibleId?: number
eventTypeId?: number
status?: DRAFT | CREATED | COMPLETED | CANCELLED
responsibleEmployeeId?: number
dateFrom?: YYYY-MM-DD
dateTo?: YYYY-MM-DD
limit?: number = 20, max 100
offset?: number = 0
```

`dateFrom/dateTo` фильтруют `factDate`.

Сортировка:

```text
factDate DESC NULLS LAST
plannedDate DESC NULLS LAST
createdAt DESC
id DESC
```

## GET /api/equipment-events/:id

Возвращает карточку события.

## POST /api/equipment-events/manual

Создаёт ручное событие.

Body:

```json
{
  "equipmentVisibleId": 1,
  "eventTypeId": 1,
  "factDate": "2026-07-15",
  "responsibleEmployeeIds": [1, 2]
}
```

Правила:

- `factDate` обязательна и не может быть в будущем;
- минимум один ответственный обязателен после дедупликации;
- тип события должен быть активен;
- тип события должен быть доступен модели оборудования.

Результат:

```text
source = MANUAL
status = DRAFT
version = 1
```

## PATCH /api/equipment-events/:id

Изменяет только событие в статусе `DRAFT`.

Body:

```json
{
  "version": 1,
  "factDate": "2026-07-14",
  "responsibleEmployeeIds": [2, 3]
}
```

Допустимые поля:

```text
equipmentVisibleId?: number
eventTypeId?: number
factDate?: YYYY-MM-DD
responsibleEmployeeIds?: number[]
version: number
```

`version` обязательна для optimistic locking. Если клиент отправил старую версию, API возвращает `409 Conflict`.

Если PATCH не меняет бизнес-данные, событие возвращается без увеличения
`version` и без audit-записи. До `updateMany` сервис сравнивает оборудование,
тип события, фактическую дату и множество ответственных.

## POST /api/equipment-events/:id/complete

Завершает событие.

Body опционален:

```json
{
  "factDate": "2026-07-15"
}
```

Если `factDate` не передана, используется уже сохранённая дата события.

## POST /api/equipment-events/:id/cancel

Отменяет событие.

Повторная отмена или отмена завершённого события возвращает `409 Conflict`.

## Audit

В `audit_log` пишутся:

- создание события — `CREATE`;
- изменение черновика — `UPDATE`, отдельными строками по изменённым полям;
- выполнение и отмена — `STATUS_CHANGE`.

Для события используется:

```text
module = EQUIPMENT
entityType = equipment_event
entityId = event.id
```

## Типовые ошибки

Ответы ошибок имеют форму:

```json
{
  "code": "EVENT_STATUS_CONFLICT",
  "message": "Событие в текущем статусе нельзя изменить."
}
```

Частые коды:

```text
EQUIPMENT_NOT_FOUND
EVENT_TYPE_NOT_FOUND
EVENT_TYPE_NOT_AVAILABLE_FOR_MODEL
RESPONSIBLES_REQUIRED
RESPONSIBLE_NOT_FOUND
USER_EMPLOYEE_NOT_FOUND
EVENT_NOT_FOUND
EVENT_STATUS_CONFLICT
EVENT_VERSION_CONFLICT
FACT_DATE_IN_FUTURE
VERSION_REQUIRED
UPDATE_EMPTY
```

## Maintenance settings

Настройки обслуживания живут внутри модуля событий, потому что работают с
связкой `equipment_model_event_types`: модель оборудования → тип события.

Фронтенд всегда работает через `equipment.visibleId`; `modelId` наружу не
передаётся.

### GET /api/equipment/:visibleId/maintenance-settings

Возвращает настройки обслуживания для модели выбранного оборудования:

```json
{
  "equipment": {
    "visibleId": 125,
    "name": "Компрессор №2"
  },
  "affectedEquipmentCount": 8,
  "settings": [
    {
      "checklistTemplateId": null,
      "eventType": {
        "id": 2,
        "code": "MAINTENANCE",
        "name": "Техническое обслуживание",
        "isActive": true
      },
      "executionType": "INTERNAL",
      "periodicity": {
        "value": 3,
        "unit": "MONTH"
      }
    }
  ]
}
```

`affectedEquipmentCount` показывает, сколько карточек оборудования той же
модели затронет изменение настроек.

### GET /api/equipment/:visibleId/maintenance-settings/available-event-types

Возвращает активные типы событий, которые ещё не назначены модели оборудования.

### POST /api/equipment/:visibleId/maintenance-settings

Назначает существующий тип события модели оборудования.

Body:

```json
{
  "eventTypeId": 2,
  "checklistTemplateId": null,
  "executionType": "INTERNAL",
  "periodicity": null
}
```

Для периодического события дополнительно передаются:

```json
{
  "eventTypeId": 2,
  "checklistTemplateId": null,
  "executionType": "INTERNAL",
  "periodicity": {
    "value": 3,
    "unit": "MONTH"
  }
}
```

`periodicity` — основной формат для нового фронтенда. Для переходного периода
backend также принимает плоские поля `periodicityValue` и `periodicityUnit`, но
смешивать объект и плоские поля в одном запросе нельзя.

`checklistTemplateId` на текущем этапе хранится как nullable ID. Проверка
существования и активности шаблона будет добавлена вместе с `ChecklistModule`.

### PATCH /api/equipment/:visibleId/maintenance-settings/:eventTypeId

Изменяет настройку. Можно передать одно или несколько полей:

```json
{
  "checklistTemplateId": null,
  "executionType": "EXTERNAL",
  "periodicity": {
    "value": 6,
    "unit": "MONTH"
  }
}
```

Периодичность очищается основным форматом:

```json
{
  "periodicity": null
}
```

Временно поддерживается и плоская очистка, но оба поля должны передаваться
вместе:

```json
{
  "periodicityValue": null,
  "periodicityUnit": null
}
```

Передача только одного `null` приведёт к ошибке валидации.
`checklistTemplateId: null` очищает шаблон чек-листа. `executionType`
обязателен на уровне БД и не может быть очищен.

### DELETE /api/equipment/:visibleId/maintenance-settings/:eventTypeId

Удаляет связь типа события с моделью оборудования. Настройка удаляется для всей
модели оборудования; уже созданные события не удаляются и не изменяются.

### POST /api/equipment/:visibleId/maintenance-settings/event-types

Создаёт новый тип события и сразу назначает его модели оборудования.

Body:

```json
{
  "name": "Техническое обслуживание",
  "code": "MAINTENANCE",
  "checklistTemplateId": null,
  "executionType": "INTERNAL",
  "periodicity": {
    "value": 3,
    "unit": "MONTH"
  }
}
```

`code` — технический код: латинские заглавные буквы, цифры и `_`, первый символ
обязательно буква. Примеры: `MAINTENANCE`, `WEEKLY_DIAGNOSTICS`.

Доступ:

- просмотр — любой авторизованный пользователь;
- изменение — `admin`, `chief_engineer`.

### Ошибки Maintenance settings

Основные коды:

```text
MAINTENANCE_SETTING_NOT_FOUND
MAINTENANCE_SETTING_ALREADY_EXISTS
MAINTENANCE_SETTING_UPDATE_EMPTY
EVENT_TYPE_CODE_ALREADY_EXISTS
EVENT_TYPE_NAME_ALREADY_EXISTS
EXECUTION_TYPE_INVALID
PERIODICITY_INVALID
PERIODICITY_FORMAT_CONFLICT
PERIODICITY_VALUE_INVALID
PERIODICITY_UNIT_INVALID
REQUEST_BODY_REQUIRED
```
