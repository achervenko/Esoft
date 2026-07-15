# Equipment Events API

Backend-only модуль событий оборудования.

## Доступ

- Просмотр: любой авторизованный пользователь.
- Создание, изменение назначенного события и отмена: `admin`, `chief_engineer`.
- Взятие в работу и завершение: только назначенный ответственный пользователь.

## Статусы

- `DRAFT` — незавершённое создание события, если появится отдельный черновик формы.
- `CREATED` — событие назначено и ожидает начала работ.
- `IN_PROGRESS` — ответственный начал выполнение.
- `COMPLETED` — работы завершены.
- `CANCELLED` — событие отменено.

Разрешённые переходы:

```text
CREATED     -> IN_PROGRESS
CREATED     -> CANCELLED
IN_PROGRESS -> COMPLETED
IN_PROGRESS -> CANCELLED
```

`COMPLETED` и `CANCELLED` — терминальные статусы.

## GET /api/equipment-events

Возвращает список событий.

Query:

```text
equipmentVisibleId?: number
maintenanceTypeId?: number
status?: DRAFT | CREATED | IN_PROGRESS | COMPLETED | CANCELLED
responsibleUserId?: string
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

## GET /api/equipment-events/responsible-users

Возвращает активных пользователей, связанных с сотрудниками. Используется для
выбора ответственных в формах создания и редактирования события.

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
  "responsibleUserIds": ["user-id-1", "user-id-2"]
}
```

Правила:

- `plannedDate` обязательна и может быть будущей датой;
- `factDate` при создании не передаётся и сохраняется как `null`;
- минимум один ответственный обязателен после дедупликации;
- вид обслуживания должен быть активен;
- для модели оборудования должна существовать настройка этого вида обслуживания;
- `maintenanceSettingId` сохраняется как ссылка на настройку обслуживания и
  станет `null`, если настройку удалить;
- `executionType` и `checklistTemplateId` сохраняются в событие снимком на
  момент создания;
- выбранный вид обслуживания хранится как связь `eventTypeId` со справочником,
  поэтому его название и код могут измениться при редактировании справочника.

Результат:

```text
source = MANUAL
status = CREATED
plannedDate = выбранная дата
factDate = null
version = 1
```

## PATCH /api/equipment-events/:id

Изменяет только назначенное событие в статусе `CREATED`, пока работы ещё не начались.

Body:

```json
{
  "version": 1,
  "plannedDate": "2026-07-23",
  "note": "Комментарий уточнён",
  "responsibleUserIds": ["user-id-2", "user-id-3"]
}
```

Допустимые поля:

```text
equipmentVisibleId?: number
maintenanceTypeId?: number
plannedDate?: YYYY-MM-DD
note?: string | null
responsibleUserIds?: string[]
version: number
```

`version` обязательна для optimistic locking. Если клиент отправил старую версию, API возвращает `409 Conflict`.

Если PATCH не меняет бизнес-данные, событие возвращается без увеличения
`version` и без audit-записи. До `updateMany` сервис сравнивает оборудование,
вид обслуживания, плановую дату, комментарий и множество ответственных. При
изменении оборудования или вида обслуживания снимок настройки обслуживания
пересчитывается.

## POST /api/equipment-events/:id/start

Переводит назначенное событие в работу.

Доступ: назначенный ответственный пользователь.

```text
CREATED -> IN_PROGRESS
```

## POST /api/equipment-events/:id/complete

Завершает событие.

Доступ: назначенный ответственный пользователь.

Body опционален:

```json
{
  "factDate": "2026-07-15"
}
```

Если `factDate` не передана, используется уже сохранённая дата события. Если
даты нет ни в запросе, ни в событии, API возвращает `FACT_DATE_REQUIRED`.
Для назначенного события фактическая дата обычно передаётся при завершении.

## POST /api/equipment-events/:id/cancel

Отменяет событие.

Повторная отмена или отмена завершённого события возвращает `409 Conflict`.

## Audit

В `audit_log` пишутся:

- создание события — `CREATE`;
- изменение назначенного события — `UPDATE`, отдельными строками по изменённым полям;
- изменение статуса — `STATUS_CHANGE`, включая `CREATED -> IN_PROGRESS`,
  `IN_PROGRESS -> COMPLETED` и отмену;
- при завершении дополнительно пишется `UPDATE` по полю «Фактическая дата»,
  если дата изменилась.

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
MAINTENANCE_TYPE_NOT_FOUND
MAINTENANCE_TYPE_INACTIVE
MAINTENANCE_TYPE_INVALID
MAINTENANCE_TYPE_REQUIRED
MAINTENANCE_SETTING_NOT_FOUND
RESPONSIBLES_REQUIRED
RESPONSIBLE_NOT_FOUND
RESPONSIBLE_USER_INACTIVE
USER_EMPLOYEE_NOT_FOUND
EVENT_NOT_FOUND
EVENT_RESPONSIBLE_REQUIRED
EVENT_STATUS_CONFLICT
EVENT_VERSION_CONFLICT
FACT_DATE_REQUIRED
FACT_DATE_IN_FUTURE
PLANNED_DATE_INVALID
PLANNED_DATE_REQUIRED
VERSION_REQUIRED
UPDATE_EMPTY
```

## Maintenance settings

Настройки обслуживания моделей задаются таблицей
`equipment_maintenance_settings`: модель оборудования → вид обслуживания.
Фронтенд всегда работает через `equipment.visibleId`; `modelId` наружу не
передаётся.

Доступ:

- просмотр — любой авторизованный пользователь;
- изменение — `admin`, `chief_engineer`.

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
      "id": 10,
      "checklistTemplateId": null,
      "maintenanceType": {
        "id": 2,
        "name": "Техническое обслуживание",
        "isActive": true
      },
      "executionType": "INTERNAL",
      "periodicity": {
        "years": 1,
        "months": 2,
        "weeks": 0,
        "days": 5
      }
    }
  ]
}
```

`affectedEquipmentCount` показывает, сколько карточек оборудования той же
модели затронет изменение настроек.

### GET /api/equipment/:visibleId/maintenance-settings/available-types

Возвращает активные виды обслуживания, которые ещё не настроены для модели
оборудования:

```json
{
  "maintenanceTypes": [
    {
      "id": 3,
      "name": "Диагностика"
    }
  ]
}
```

### POST /api/equipment/:visibleId/maintenance-settings

Добавляет настройку существующего вида обслуживания для модели оборудования.

Body:

```json
{
  "maintenanceTypeId": 2,
  "checklistTemplateId": null,
  "executionType": "INTERNAL",
  "periodicity": null
}
```

Для периодического обслуживания передаётся:

```json
{
  "maintenanceTypeId": 2,
  "checklistTemplateId": null,
  "executionType": "INTERNAL",
  "periodicity": {
    "years": 0,
    "months": 3,
    "weeks": 0,
    "days": 0
  }
}
```

`periodicity` передаётся только объектом или `null`. Компоненты `years`,
`months`, `weeks`, `days` должны быть целыми неотрицательными числами. Если
компонент не передан, backend нормализует его в `0`. Если объект передан, хотя
бы один компонент должен быть больше `0`. Старые плоские поля
`periodicityValue` и `periodicityUnit` не используются.

`checklistTemplateId` на текущем этапе хранится как nullable ID. Проверка
существования и активности шаблона будет добавлена вместе с `ChecklistModule`.

### PATCH /api/equipment/:visibleId/maintenance-settings/:settingId

Изменяет настройку. Можно передать одно или несколько полей:

```json
{
  "checklistTemplateId": null,
  "executionType": "EXTERNAL",
  "periodicity": {
    "years": 0,
    "months": 6,
    "weeks": 0,
    "days": 0
  }
}
```

Периодичность очищается основным форматом:

```json
{
  "periodicity": null
}
```

`checklistTemplateId: null` очищает шаблон чек-листа. `executionType`
обязателен на уровне БД и не может быть очищен. `maintenanceTypeId` в PATCH не
изменяется.

### DELETE /api/equipment/:visibleId/maintenance-settings/:settingId

Удаляет настройку вида обслуживания для всей модели оборудования. Уже созданные
события не удаляются и не изменяются.

### Ошибки Maintenance settings

Основные коды:

```text
MAINTENANCE_SETTING_NOT_FOUND
MAINTENANCE_SETTING_ALREADY_EXISTS
MAINTENANCE_SETTING_UPDATE_EMPTY
MAINTENANCE_TYPE_REQUIRED
MAINTENANCE_TYPE_INVALID
MAINTENANCE_TYPE_NOT_FOUND
MAINTENANCE_TYPE_INACTIVE
CHECKLIST_TEMPLATE_ID_INVALID
EXECUTION_TYPE_INVALID
PERIODICITY_INVALID
PERIODICITY_FORMAT_CONFLICT
PERIODICITY_VALUE_INVALID
REQUEST_BODY_REQUIRED
```

## Maintenance types

Справочник видов обслуживания управляется отдельным API.

Доступ:

- `GET /api/maintenance-types` без `includeInactive` — любой авторизованный пользователь;
- создание, изменение, включение, отключение и просмотр неактивных записей — только `admin`.

### GET /api/maintenance-types

Возвращает активные виды обслуживания. Query:

```text
includeInactive?: boolean
```

`includeInactive=true` доступен только `admin`.

Ответ:

```json
{
  "maintenanceTypes": [
    {
      "id": 1,
      "name": "ТО-1",
      "code": "TO_1",
      "isActive": true
    }
  ]
}
```

### POST /api/maintenance-types

Создаёт вид обслуживания. Доступен только `admin`.

```json
{
  "name": "ТО-1",
  "code": "TO_1"
}
```

`code` — технический код: латинские заглавные буквы, цифры и `_`, первый символ
обязательно буква.

### PATCH /api/maintenance-types/:id

Переименовывает вид обслуживания. Доступен только `admin`.

```json
{
  "name": "ТО-1"
}
```

### POST /api/maintenance-types/:id/activate

Включает вид обслуживания. Доступен только `admin`.

### POST /api/maintenance-types/:id/deactivate

Отключает вид обслуживания. Доступен только `admin`.

### Ошибки Maintenance types

Основные коды:

```text
MAINTENANCE_TYPE_NOT_FOUND
MAINTENANCE_TYPE_NAME_REQUIRED
MAINTENANCE_TYPE_NAME_TOO_LONG
MAINTENANCE_TYPE_CODE_REQUIRED
MAINTENANCE_TYPE_CODE_TOO_LONG
MAINTENANCE_TYPE_CODE_INVALID
MAINTENANCE_TYPE_CODE_ALREADY_EXISTS
MAINTENANCE_TYPE_NAME_ALREADY_EXISTS
MAINTENANCE_TYPE_ALREADY_ACTIVE
MAINTENANCE_TYPE_ALREADY_INACTIVE
INCLUDE_INACTIVE_INVALID
REQUEST_BODY_REQUIRED
```
