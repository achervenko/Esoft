# Equipment Events API

API событий оборудования, настроек обслуживания моделей оборудования и
справочника видов обслуживания.

## Доступ

- Просмотр событий и настроек: любой авторизованный пользователь.
- Создание, изменение назначенного события и отмена события: `admin`,
  `chief_engineer`.
- Взятие события в работу и завершение: только назначенный ответственный
  пользователь.
- Изменение настроек обслуживания: `admin`, `chief_engineer`.
- Управление справочником видов обслуживания: `admin`.

## Статусы событий

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
status?: CREATED | IN_PROGRESS | COMPLETED | CANCELLED
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
      "isRequired": true,
      "status": "CREATED",
      "sortOrder": 1
    }
  ]
}
```

## GET /api/equipment-events/:id

Возвращает карточку события. Ответ содержит те же основные поля, что список,
а также `originalPlannedDate`, `createdAt`, `createdBy` и расширенную модель
оборудования с производителем.

`checklists[]` возвращается в карточке события в том же формате:

```text
id
checklistTemplateId
assignedUserId
isRequired
status
sortOrder
```

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
  "responsibleUserIds": ["user-id-1", "user-id-2"],
  "checklistAssignments": [
    {
      "checklistTemplateId": 12,
      "assignedUserId": "user-id-1"
    },
    {
      "checklistTemplateId": 18,
      "assignedUserId": "user-id-2"
    }
  ]
}
```

Правила:

- `plannedDate` обязательна и может быть будущей датой;
- `factDate` при создании не передаётся и сохраняется как `null`;
- минимум один ответственный обязателен после дедупликации;
- вид обслуживания должен быть активен;
- для модели оборудования должна существовать настройка этого вида
  обслуживания;
- `maintenanceSettingId` сохраняется как ссылка на настройку обслуживания и
  станет `null`, если настройку удалить;
- `executionType` сохраняется в событие снимком на момент создания;
- выбранный вид обслуживания хранится как связь `eventTypeId` со справочником,
  поэтому название вида обслуживания может измениться при редактировании
  справочника; технический код остаётся неизменным;
- `checklistAssignments` должен точно соответствовать шаблонам чек-листов
  настройки обслуживания;
- `checklistTemplateId` в `checklistAssignments` не должен повторяться;
- `assignedUserId` каждого чек-листа должен входить в `responsibleUserIds`;
- каждый чек-лист получает ровно одного исполнителя;
- событие, ответственные, экземпляры чек-листов и детали чек-листов создаются
  одной транзакцией.

Если в настройке обслуживания нет шаблонов чек-листов, `checklistAssignments`
можно не передавать или передать пустым массивом.

При создании события backend сразу создаёт экземпляры чек-листов на основании
связей настройки обслуживания. В экземпляр фиксируются:

```text
checklistTemplateId
assignedUserId
isRequired
sortOrder
```

Детали чек-листа создаются снимком из опубликованной структуры шаблона.

Результат:

```text
source = MANUAL
status = CREATED
plannedDate = выбранная дата
factDate = null
originalPlannedDate = выбранная дата
version = 1
```

## PATCH /api/equipment-events/:id

Изменяет только назначенное событие в статусе `CREATED`, пока работы ещё не
начались.

Body:

```json
{
  "version": 1,
  "plannedDate": "2026-07-23",
  "note": "Комментарий уточнён",
  "responsibleUserIds": ["user-id-2", "user-id-3"]
}
```

Допустимые поля DTO:

```text
equipmentVisibleId?: number
maintenanceTypeId?: number
plannedDate?: YYYY-MM-DD
note?: string | null
responsibleUserIds?: string[]
version: number
```

`version` обязательна для optimistic locking. Если клиент отправил старую
версию, API возвращает `409 Conflict`.

Фактические ограничения:

- `checklistAssignments` в PATCH не изменяются;
- изменение `equipmentVisibleId` или `maintenanceTypeId` запрещается после
  создания чек-листов события и возвращает
  `EVENT_CHECKLISTS_ALREADY_CREATED`;
- так как чек-листы создаются вместе с событием, для событий с шаблонами
  настройки смена оборудования или вида обслуживания практически недоступна;
- при изменении `responsibleUserIds` нельзя удалить пользователя, которому уже
  назначен чек-лист события, иначе API вернёт
  `CHECKLIST_ASSIGNEE_NOT_RESPONSIBLE`.

Если PATCH не меняет бизнес-данные, событие возвращается без увеличения
`version` и без audit-записи.

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
Фактическая дата не может быть позже текущей даты в бизнес-таймзоне
`Europe/Moscow`.

Событие нельзя завершить, пока не завершены все обязательные чек-листы
(`isRequired = true`). В этом случае API возвращает
`REQUIRED_CHECKLISTS_NOT_COMPLETED`.

Необязательные незавершённые чек-листы (`isRequired = false`) не блокируют
завершение события.

## POST /api/equipment-events/:id/cancel

Отменяет событие.

Доступ: `admin`, `chief_engineer`.

Повторная отмена или отмена завершённого события возвращает `409 Conflict`.
При отмене события активные чек-листы события в статусах `CREATED` и
`IN_PROGRESS` переводятся в `CANCELLED`.

## Audit событий

В `audit_log` пишутся:

- создание события — `CREATE`;
- изменение назначенного события — `UPDATE`, отдельными строками по
  изменённым полям;
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

## Ошибки событий

Ответы ошибок имеют форму:

```json
{
  "code": "EVENT_STATUS_CONFLICT",
  "message": "Событие в текущем статусе нельзя изменить."
}
```

Частые коды:

```text
CHECKLIST_ASSIGNED_USER_INVALID
CHECKLIST_ASSIGNED_USER_NOT_RESPONSIBLE
CHECKLIST_ASSIGNEE_NOT_RESPONSIBLE
CHECKLIST_ASSIGNMENT_DUPLICATE
CHECKLIST_ASSIGNMENT_INVALID
CHECKLIST_ASSIGNMENT_TEMPLATE_INVALID
CHECKLIST_ASSIGNMENTS_INCOMPLETE
CHECKLIST_ASSIGNMENTS_INVALID
CHECKLIST_TEMPLATE_INVALID
DATE_FROM_INVALID
DATE_RANGE_INVALID
DATE_TO_INVALID
EQUIPMENT_INVALID
EQUIPMENT_NOT_FOUND
EVENT_CHECKLISTS_ALREADY_CREATED
EVENT_NOT_FOUND
EVENT_RESPONSIBLE_REQUIRED
EVENT_STATUS_CONFLICT
EVENT_VERSION_CONFLICT
FACT_DATE_IN_FUTURE
FACT_DATE_INVALID
FACT_DATE_REQUIRED
LIMIT_INVALID
MAINTENANCE_SETTING_NOT_FOUND
MAINTENANCE_TYPE_INACTIVE
MAINTENANCE_TYPE_INVALID
MAINTENANCE_TYPE_NOT_FOUND
MAINTENANCE_TYPE_REQUIRED
NOTE_INVALID
OFFSET_INVALID
PLANNED_DATE_INVALID
PLANNED_DATE_REQUIRED
REQUIRED_CHECKLISTS_NOT_COMPLETED
RESPONSIBLE_INVALID
RESPONSIBLE_NOT_FOUND
RESPONSIBLE_USER_INACTIVE
RESPONSIBLES_REQUIRED
SESSION_REQUIRED
STATUS_INVALID
UPDATE_EMPTY
USER_EMPLOYEE_NOT_FOUND
VERSION_REQUIRED
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
      "checklistTemplates": [
        {
          "checklistTemplateId": 12,
          "name": "ТО-1",
          "isRequired": true,
          "sortOrder": 1
        },
        {
          "checklistTemplateId": 18,
          "name": "Проверка электрики",
          "isRequired": false,
          "sortOrder": 2
        }
      ],
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
  "checklistTemplates": [
    {
      "checklistTemplateId": 12,
      "isRequired": true,
      "sortOrder": 1
    },
    {
      "checklistTemplateId": 18,
      "isRequired": false,
      "sortOrder": 2
    }
  ],
  "executionType": "INTERNAL",
  "periodicity": null
}
```

Для периодического обслуживания передаётся:

```json
{
  "maintenanceTypeId": 2,
  "checklistTemplates": [],
  "executionType": "INTERNAL",
  "periodicity": {
    "years": 0,
    "months": 3,
    "weeks": 0,
    "days": 0
  }
}
```

Правила `checklistTemplates`:

- поле отсутствует, `null` или пустой массив означают отсутствие связей с
  шаблонами;
- `checklistTemplateId` — положительное целое число;
- `isRequired` — boolean; если поле не передано, backend нормализует его в
  `true`;
- `sortOrder` — положительное целое число;
- `checklistTemplateId` не должен повторяться;
- `sortOrder` не должен повторяться;
- порядок должен быть непрерывным от `1` до количества шаблонов.

`periodicity` передаётся только объектом или `null`. Компоненты `years`,
`months`, `weeks`, `days` должны быть целыми неотрицательными числами. Если
компонент не передан, backend нормализует его в `0`. Если объект передан, хотя
бы один компонент должен быть больше `0`. Старые плоские поля
`periodicityValue` и `periodicityUnit` не используются.

### PATCH /api/equipment/:visibleId/maintenance-settings/:settingId

Изменяет настройку. Можно передать одно или несколько полей:

```json
{
  "checklistTemplates": [
    {
      "checklistTemplateId": 12,
      "isRequired": true,
      "sortOrder": 1
    }
  ],
  "executionType": "EXTERNAL",
  "periodicity": {
    "years": 0,
    "months": 6,
    "weeks": 0,
    "days": 0
  }
}
```

Пустой массив очищает связи настройки с шаблонами чек-листов:

```json
{
  "checklistTemplates": []
}
```

Периодичность очищается основным форматом:

```json
{
  "periodicity": null
}
```

`executionType` обязателен на уровне БД и не может быть очищен.
`maintenanceTypeId` в PATCH не изменяется.

### DELETE /api/equipment/:visibleId/maintenance-settings/:settingId

Удаляет настройку вида обслуживания для всей модели оборудования. Уже
созданные события не удаляются и не изменяются.

### Ошибки Maintenance settings

Основные коды:

```text
CHECKLIST_TEMPLATE_DUPLICATE
CHECKLIST_TEMPLATE_ID_INVALID
CHECKLIST_TEMPLATE_INVALID
CHECKLIST_TEMPLATE_REQUIRED_INVALID
CHECKLIST_TEMPLATE_SORT_ORDER_DUPLICATE
CHECKLIST_TEMPLATE_SORT_ORDER_INVALID
CHECKLIST_TEMPLATE_SORT_ORDER_SEQUENCE_INVALID
CHECKLIST_TEMPLATES_INVALID
EQUIPMENT_NOT_FOUND
EXECUTION_TYPE_INVALID
MAINTENANCE_SETTING_ALREADY_EXISTS
MAINTENANCE_SETTING_NOT_FOUND
MAINTENANCE_SETTING_UPDATE_EMPTY
MAINTENANCE_TYPE_INACTIVE
MAINTENANCE_TYPE_INVALID
MAINTENANCE_TYPE_NOT_FOUND
MAINTENANCE_TYPE_REQUIRED
PERIODICITY_FORMAT_CONFLICT
PERIODICITY_INVALID
PERIODICITY_VALUE_INVALID
REQUEST_BODY_REQUIRED
SESSION_REQUIRED
```

## Maintenance types

Справочник видов обслуживания управляется отдельным API.

Доступ:

- `GET /api/maintenance-types` без `includeInactive` — любой авторизованный
  пользователь;
- создание, изменение, включение, отключение и просмотр неактивных записей —
  только `admin`.

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
INCLUDE_INACTIVE_INVALID
MAINTENANCE_TYPE_ALREADY_ACTIVE
MAINTENANCE_TYPE_ALREADY_INACTIVE
MAINTENANCE_TYPE_CODE_ALREADY_EXISTS
MAINTENANCE_TYPE_CODE_INVALID
MAINTENANCE_TYPE_CODE_REQUIRED
MAINTENANCE_TYPE_CODE_TOO_LONG
MAINTENANCE_TYPE_NAME_ALREADY_EXISTS
MAINTENANCE_TYPE_NAME_REQUIRED
MAINTENANCE_TYPE_NAME_TOO_LONG
MAINTENANCE_TYPE_NOT_FOUND
REQUEST_BODY_REQUIRED
```
