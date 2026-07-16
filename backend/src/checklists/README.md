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

Административные endpoints модулей, вопросов и шаблонов требуют роль `admin`.
Идентификаторы пользователей для полей `createdBy`, `updatedBy`,
`publishedBy`, `archivedBy` берутся только из сессии.

Рабочие endpoints `/api/checklists` доступны авторизованным пользователям по
правилам назначения чек-листов и роли пользователя.

## Endpoints

### Модули

```text
GET  /api/checklist-modules
GET  /api/checklist-modules/:id
POST /api/checklist-modules
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
PATCH  /api/checklist-templates/:id
DELETE /api/checklist-templates/:id

POST   /api/checklist-templates/:templateId/modules
DELETE /api/checklist-templates/:templateId/modules/:templateModuleId
PUT    /api/checklist-templates/:templateId/modules/order

POST   /api/checklist-templates/:templateId/modules/:templateModuleId/questions
PATCH  /api/checklist-templates/:templateId/questions/:templateQuestionId
DELETE /api/checklist-templates/:templateId/questions/:templateQuestionId
PUT    /api/checklist-templates/:templateId/modules/:templateModuleId/questions/order

POST   /api/checklist-templates/:id/publish
POST   /api/checklist-templates/:id/archive
POST   /api/checklist-templates/:id/copy
```

## Бизнес-правила

- Модули и вопросы не удаляются физически, только активируются и деактивируются.
- Деактивированные модули и вопросы нельзя добавлять в новые шаблоны.
- Черновик шаблона можно редактировать полностью.
- После публикации структуру шаблона менять нельзя.
- Опубликованный шаблон нельзя вернуть в черновик или удалить.
- Архивирование шаблона удаляет его связи с настройками обслуживания, но не
  изменяет уже созданные события и экземпляры чек-листов.
- Копирование создаёт новый черновик с новой структурой и новыми идентификаторами.
- Операции изменения структуры выполняются транзакционно.

## Статусы шаблонов

В ответах API состояние шаблона возвращается в поле `state`:

```text
DRAFT -> ACTIVE -> ARCHIVED
```

`ACTIVE` означает опубликованный шаблон.

- `DRAFT` — черновик. Можно менять карточку шаблона, добавлять и удалять
  модули и вопросы, менять обязательность вопросов, порядок модулей и порядок
  вопросов. Черновик можно удалить или опубликовать.
- `ACTIVE` — опубликованный шаблон. Структуру и основные поля менять нельзя.
  Шаблон можно использовать в настройках обслуживания и при создании событий.
  Опубликованный шаблон можно архивировать или скопировать в новый черновик.
- `ARCHIVED` — архивный шаблон. Он не должен использоваться в новых настройках
  обслуживания. Архивирование удаляет связи с настройками обслуживания, но
  сохраняет сам шаблон, уже созданные события и экземпляры чек-листов.

Публикация выполняется только для черновика и проверяет:

- модель оборудования существует и активна;
- вид обслуживания существует и активен;
- структура шаблона валидна;
- шаблон содержит хотя бы один модуль;
- каждый модуль содержит хотя бы один вопрос;
- модули и вопросы имеют непустые снимки названий/текстов;
- порядок модулей и вопросов непрерывный и корректный.

## Optimistic locking шаблонов

Для операций изменения шаблона используется обязательное optimistic locking
через поле `version`. Клиент должен передать ожидаемую версию в body запроса.
Если `version` не передана или некорректна, API возвращает
`CHECKLIST_TEMPLATE_VERSION_INVALID`. Если версия не совпадает с текущей,
возвращается `409 Conflict` с кодом `CHECKLIST_TEMPLATE_VERSION_CONFLICT`.

После успешного изменения `version` шаблона увеличивается. Проверка версии и
само изменение выполняются в одной транзакции.

`version` обязателен в body для endpoints:

```text
PATCH  /api/checklist-templates/:id
DELETE /api/checklist-templates/:id

POST   /api/checklist-templates/:templateId/modules
DELETE /api/checklist-templates/:templateId/modules/:templateModuleId
PUT    /api/checklist-templates/:templateId/modules/order

POST   /api/checklist-templates/:templateId/modules/:templateModuleId/questions
PATCH  /api/checklist-templates/:templateId/questions/:templateQuestionId
DELETE /api/checklist-templates/:templateId/questions/:templateQuestionId
PUT    /api/checklist-templates/:templateId/modules/:templateModuleId/questions/order

POST   /api/checklist-templates/:id/publish
POST   /api/checklist-templates/:id/archive
```

Примеры body:

```json
{
  "name": "ТО-1 обновлённый",
  "version": 3
}
```

```json
{
  "checklistModuleId": 12,
  "version": 3
}
```

```json
{
  "moduleIds": [41, 42, 43],
  "version": 3
}
```

```json
{
  "reason": "Заменён новым шаблоном",
  "version": 3
}
```

`POST /api/checklist-templates` создаёт новый черновик и не требует `version`.
`POST /api/checklist-templates/:id/copy` создаёт новый черновик-копию и тоже
не требует `version`.

## Рабочие чек-листы

Рабочие чек-листы создаются вместе с событием оборудования. Структура вопросов
фиксируется снимком в таблице `checklist_details`; при заполнении API использует
`checklistDetailId`, то есть `checklist_details.id`. `questionId` из банка
вопросов может возвращаться только как справочное поле и не используется для
мутаций.

### Доступ

- Обычный пользователь в списке видит только назначенные ему чек-листы.
- `admin` и `chief_engineer` в списке видят все чек-листы.
- Карточку чек-листа может открыть назначенный исполнитель, ответственный по
  событию, `admin` или `chief_engineer`.
- `start`, `answers` и `complete` доступны только назначенному исполнителю.

### GET /api/checklists

Возвращает рабочий список чек-листов.

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

Вопросы возвращают:

```text
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
