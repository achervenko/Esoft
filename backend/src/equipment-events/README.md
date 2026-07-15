# Equipment Events API

Backend-only модуль событий оборудования.

## Доступ

- Просмотр: любой авторизованный пользователь.
- Создание, изменение, выполнение и отмена: `admin`, `chief_engineer`.

## Статусы

- `DRAFT` — ручное событие создано, но ещё не подтверждено.
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

Если PATCH не меняет бизнес-данные, событие возвращается без увеличения `version` и без audit-записи.

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
