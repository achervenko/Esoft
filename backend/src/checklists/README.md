# Checklists Backend

Модуль отвечает за административное управление чек-листами оборудования и
рабочие экземпляры чек-листов событий оборудования.

## Структура

```text
checklists/
├── checklist-common/
├── checklist-modules/
├── checklist-questions/
├── checklist-templates/
└── checklist-work/
```

## Доступ

Административные endpoints модулей, вопросов и шаблонов требуют роль `admin`
или `chief_engineer`. Идентификаторы пользователей для полей `createdBy`,
`updatedBy`, `publishedBy`, `archivedBy` берутся только из сессии.

Рабочие endpoints `/api/checklists` доступны авторизованным пользователям
только по правилу назначения чек-листа.

Пользователь может работать только с чек-листами, где он указан как
`assignedUserId`.

## Endpoints

### Модули

```text
GET  /api/checklist-modules
GET  /api/checklist-modules/:id
POST /api/checklist-modules
PATCH /api/checklist-modules/reorder
PATCH /api/checklist-modules/:moduleId/questions/reorder
PATCH /api/checklist-modules/:id
POST /api/checklist-modules/:id/activate
POST /api/checklist-modules/:id/deactivate
```

### Вопросы

```text
GET  /api/checklist-questions
GET  /api/checklist-questions/:id
POST /api/checklist-questions
PATCH /api/checklist-questions/:id
POST /api/checklist-questions/:id/activate
POST /api/checklist-questions/:id/deactivate
```

### Шаблоны

```text
GET    /api/checklist-templates
GET    /api/checklist-templates/:id
POST   /api/checklist-templates
POST   /api/checklist-templates/:id/archive
```

## Бизнес-правила

- Модули и вопросы не удаляются физически, только активируются и деактивируются.
- Для активных модулей поддерживается явный каталоговый `sortOrder`.
- Для активных вопросов внутри модуля поддерживается явный `sortOrder`.
- Вопрос может временно не принадлежать ни одному модулю:
  `checklistModuleId = null`, `sortOrder = null`.
- Деактивированные модули и вопросы нельзя добавлять в новые шаблоны.
- Вопрос шаблона должен принадлежать тому же модулю, что и секция шаблона.
- Новый шаблон собирается на frontend локально и создаётся одним запросом.
- Созданный шаблон сразу становится действующим (`ACTIVE`).
- Действующий шаблон нельзя редактировать по шагам.
- Архивирование шаблона удаляет его связи с настройками обслуживания, но не
  изменяет уже созданные события и экземпляры чек-листов.
- Копирование выполняется на frontend как локальная подготовка нового шаблона.
- Создание готового шаблона выполняется транзакционно.

## Статусы шаблонов

В ответах API состояние шаблона возвращается в поле `state`:

```text
ACTIVE -> ARCHIVED
```

- `ACTIVE` — действующий шаблон. Структуру и основные поля менять нельзя.
  Шаблон можно использовать в настройках обслуживания и при создании событий.
  Действующий шаблон можно архивировать или скопировать в новый локальный
  шаблон.
- `ARCHIVED` — архивный шаблон. Он не должен использоваться в новых настройках
  обслуживания. Архивирование удаляет связи с настройками обслуживания, но
  сохраняет сам шаблон, уже созданные события и экземпляры чек-листов.

Техническое поле `isPublished` всегда равно `true` для шаблонов, доступных
через API этого модуля. Фильтрация по `isPublished` запрещена; для клиентов
доступно только бизнес-состояние `state`.

Создание шаблона проверяет:

- структура шаблона валидна;
- шаблон содержит хотя бы один модуль;
- каждый модуль содержит хотя бы один вопрос;
- модули и вопросы имеют непустые снимки названий/текстов;
- порядок модулей и вопросов непрерывный и корректный.

## Создание и архивирование шаблонов

`POST /api/checklist-templates` создаёт готовый действующий шаблон одним
запросом и не требует `version`. Поля `equipmentModelId`, `maintenanceTypeId`,
`isActive`, `isPublished` этим методом передавать нельзя.

Пример body:

```json
{
  "name": "Диагностика",
  "description": null,
  "modules": [
    {
      "checklistModuleId": 1,
      "sortOrder": 1,
      "questions": [
        {
          "checklistQuestionId": 10,
          "isRequired": true,
          "sortOrder": 1
        }
      ]
    }
  ]
}
```

Архивирование использует optimistic locking через поле `version`.

```json
{
  "reason": "Заменён новым шаблоном",
  "version": 3
}
```

## Каталог модулей и вопросов

### GET /api/checklist-modules

Query:

```text
isActive?: boolean
search?: string
sortBy?: name | createdAt | updatedAt | sortOrder
sortDirection?: asc | desc
page?: number = 1
limit?: number = 20, max 100
```

По умолчанию модули сортируются по `sortOrder asc`.

### PATCH /api/checklist-modules/reorder

Меняет порядок всех активных модулей одним запросом. В `items` нужно передать
полный активный набор без пропусков и повторов по `sortOrder`.

```json
{
  "items": [
    { "id": 3, "sortOrder": 1 },
    { "id": 1, "sortOrder": 2 }
  ]
}
```

### GET /api/checklist-questions

Query:

```text
checklistModuleId?: number | null
moduleId?: number | null
answerType?: BOOLEAN | INTEGER | DECIMAL | TEXT | DATE
isActive?: boolean
search?: string
sortBy?: questionText | createdAt | updatedAt | sortOrder
sortDirection?: asc | desc
page?: number = 1
limit?: number = 20, max 100
```

- `checklistModuleId` и `moduleId` равнозначны.
- `checklistModuleId = null` возвращает вопросы без модуля.
- Если фильтр по модулю не передан, список по умолчанию идёт по
  `createdAt desc, id desc`.
- Если фильтр по модулю передан, список по умолчанию идёт по `sortOrder asc`.

### PATCH /api/checklist-modules/:moduleId/questions/reorder

Меняет порядок всех активных вопросов конкретного модуля. `moduleId` должен
существовать, а `items` должны покрывать полный активный набор вопросов этого
модуля без пропусков и повторов.

```json
{
  "items": [
    { "id": 12, "sortOrder": 1 },
    { "id": 15, "sortOrder": 2 }
  ]
}
```

## Рабочие чек-листы

Рабочие чек-листы создаются вместе с событием оборудования. Структура вопросов
фиксируется снимком в таблице `checklist_details`; при заполнении API использует
`checklistDetailId`, то есть `checklist_details.id`. `questionId` из банка
вопросов может возвращаться только как справочное поле и не используется для
мутаций.

### Доступ

- Любой пользователь в списке видит только назначенные ему чек-листы.
- Карточку чек-листа может открыть только назначенный исполнитель.
- `start`, `answers` и `complete` доступны только назначенному исполнителю.

### GET /api/checklists

Возвращает рабочий список чек-листов.

Список всегда фильтруется по текущему пользователю из авторизации:

```text
checklist.assignedUserId = request.user.id
```

Query-параметр `userId` не поддерживается.

Query:

```text
status?: CREATED | IN_PROGRESS | COMPLETED | CANCELLED | INVALIDATED
equipmentVisibleId?: number
eventId?: number
dateFrom?: YYYY-MM-DD
dateTo?: YYYY-MM-DD
limit?: number = 20, max 100
offset?: number = 0
```

По умолчанию возвращаются активные статусы `CREATED` и `IN_PROGRESS`.
`dateFrom/dateTo` фильтруют `event.plannedDate`.

Сортировка:

```text
event.plannedDate ASC NULLS LAST
eventId ASC
sortOrder ASC
id ASC
```

Ответ:

```json
{
  "items": [
    {
      "id": 501,
      "status": "CREATED",
      "isRequired": true,
      "sortOrder": 1,
      "template": {
        "id": 12,
        "name": "Ежедневный осмотр"
      },
      "event": {
        "id": 101,
        "status": "IN_PROGRESS",
        "plannedDate": "2026-07-22",
        "maintenanceType": {
          "id": 2,
          "name": "Техническое обслуживание"
        }
      },
      "equipment": {
        "visibleId": 125,
        "name": "Компрессор №2",
        "model": {
          "name": "К-500"
        }
      },
      "progress": {
        "answered": 3,
        "total": 10,
        "requiredAnswered": 2,
        "requiredTotal": 6
      }
    }
  ],
  "total": 35
}
```

`total` считается отдельно от страницы, поэтому при пустой странице из-за
большого `offset` он всё равно отражает общее число найденных записей.

### GET /api/checklists/:id

Возвращает карточку чек-листа: версию, событие, оборудование, шаблон, progress
и сгруппированные модули/вопросы.

Доступ:

```text
checklist.assignedUserId = request.user.id
```

Если чек-лист назначен другому пользователю, endpoint возвращает:

```text
403 CHECKLIST_ACCESS_DENIED
```

Вопросы возвращают:

```
checklistDetailId
questionId?: number | null
text
answerType
isRequired
sortOrder
answer
answeredAt
```

Модули группируются по снимку `moduleSortOrder/moduleName` и возвращают
`moduleKey`, `name`, `sortOrder`, `questions[]`. `moduleKey` является
техническим ключом внутри конкретного экземпляра чек-листа, а не ID исходного
модуля.

### POST /api/checklists/:id/start

Body:

```json
{
  "version": 1
}
```

Правила:

- `version` обязательна;
- требуется `checklist.status = CREATED`;
- требуется `event.status = IN_PROGRESS`;
- успешный start переводит чек-лист в `IN_PROGRESS`, заполняет `startedAt`,
  `startedBy` и увеличивает `version` на 1;
- устаревшая версия возвращает `409 CHECKLIST_VERSION_CONFLICT`;
- повторный start при актуальной версии возвращает
  `CHECKLIST_STATUS_CONFLICT`.

### PATCH /api/checklists/:id/answers

Body:

```json
{
  "version": 3,
  "answers": [
    {
      "checklistDetailId": 9001,
      "value": true
    },
    {
      "checklistDetailId": 9002,
      "value": "123.456700"
    }
  ]
}
```

Правила:

- `version` обязательна;
- пакет `answers` не должен быть пустым;
- требуется `checklist.status = IN_PROGRESS`;
- требуется `event.status = IN_PROGRESS`;
- обновляются только существующие строки `checklist_details`, принадлежащие
  этому чек-листу; insert/upsert не выполняется;
- `checklistDetailId` не должен повторяться в одном пакете;
- `null` очищает ответ и одновременно очищает `answeredAt` и `answeredBy`;
- no-op не увеличивает `version` и не пишет audit.

Поддерживаемые типы:

- `BOOLEAN` — только JSON boolean.
- `INTEGER` — safe integer или строка с целым числом.
- `DECIMAL` — только строка формата `-?\d+(\.\d{1,6})?`; scientific notation
  запрещён; после нормализации допускается не более 12 цифр в целой части и не
  более 6 в дробной; значение должно помещаться в `NUMERIC(18, 6)`.
- `TEXT` — строка с trim; пустая строка сохраняется как `null`.
- `DATE` — строго `YYYY-MM-DD`.

Для `DECIMAL` сравнение no-op выполняется по нормализованному значению:
ведущие нули и хвостовые нули дробной части не учитываются, `-0`
нормализуется в `0`.

### POST /api/checklists/:id/complete

Body:

```json
{
  "version": 4
}
```

Правила:

- `version` обязательна;
- требуется `checklist.status = IN_PROGRESS`;
- требуется `event.status = IN_PROGRESS`;
- все обязательные вопросы чек-листа должны быть заполнены;
- успешное завершение переводит чек-лист в `COMPLETED`, заполняет
  `completedAt`, `completedBy` и увеличивает `version` на 1;
- после `COMPLETED` ответы менять нельзя.

## Locking protocol рабочих чек-листов

Для `start`, `answers` и `complete`, где endpoint получает только
`checklistId`, используется единый порядок блокировок:

```text
1. Предварительно прочитать checklist.equipmentEventId внутри транзакции, но
   без FOR UPDATE.
2. SELECT equipment_event ... FOR UPDATE.
3. SELECT checklist ... FOR UPDATE.
4. Повторно проверить, что checklist существует и equipmentEventId не изменился.
5. Проверить доступ, статус события, статус чек-листа и version.
6. Выполнить изменение, audit и commit.
```

Завершение события оборудования блокирует строку события первой, затем все
активные чек-листы события в стабильном порядке `ORDER BY id`. После успешного
завершения события необязательные активные чек-листы из уже заблокированного
набора автоматически переводятся в `CANCELLED`.

Автоотмена необязательного чек-листа при завершении события:

```text
status = CANCELLED
cancelledAt = now
cancelledBy = пользователь, завершивший событие
cancellationReason = "Событие завершено"
version += 1
```

При обычной отмене события оборудования активные чек-листы события в статусах
`CREATED` и `IN_PROGRESS` также переводятся в `CANCELLED` из уже
заблокированного набора:

```text
status = CANCELLED
cancelledAt = now
cancelledBy = пользователь, отменивший событие
cancellationReason = "Событие оборудования отменено."
version += 1
```

## Ошибки рабочих чек-листов

Основные коды:

```text
CHECKLIST_NOT_FOUND
CHECKLIST_ACCESS_DENIED
CHECKLIST_NOT_ASSIGNED
CHECKLIST_STATUS_CONFLICT
CHECKLIST_VERSION_INVALID
CHECKLIST_VERSION_CONFLICT
CHECKLIST_EVENT_NOT_IN_PROGRESS
CHECKLIST_QUESTION_NOT_FOUND
CHECKLIST_QUESTION_DUPLICATE
CHECKLIST_ANSWER_TYPE_INVALID
CHECKLIST_ANSWER_VALUE_INVALID
CHECKLIST_REQUIRED_ANSWERS_MISSING
CHECKLIST_ANSWERS_INVALID
CHECKLIST_UPDATE_EMPTY
DATE_INVALID
SESSION_REQUIRED
```

## Audit рабочих чек-листов

В `audit_log` пишутся:

- `start` — `STATUS_CHANGE`, `entityType = equipment_event_checklist`;
- `answers` — одна `UPDATE` запись без значений ответов, где `N` считает
  только реально изменённые ответы;
- `complete` — `STATUS_CHANGE`;
- автоотмена необязательного чек-листа при завершении события — отдельная
  `STATUS_CHANGE` запись на каждый чек-лист;
- отмена активных чек-листов при отмене события оборудования — отдельная
  `STATUS_CHANGE` запись на каждый чек-лист.
