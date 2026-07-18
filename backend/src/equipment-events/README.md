# Equipment Events Module

## Назначение

Модуль управляет событиями обслуживания оборудования и связанными экземплярами чек-листов.

Актуальная модель:

- событие создаёт `admin` или `chief_engineer`;
- при создании события для каждого ответственного создаётся отдельный `Checklist`;
- событие не запускается и не завершается отдельным пользовательским endpoint;
- старт первого чек-листа автоматически переводит событие в `IN_PROGRESS`;
- завершение последнего чек-листа автоматически переводит событие в `COMPLETED`;
- отмена события переводит активные чек-листы в `CANCELLED`.

## Права

`admin` и `chief_engineer` могут:

- создавать события;
- редактировать события в статусе `CREATED`;
- отменять события в статусах `CREATED` и `IN_PROGRESS`;
- видеть статусы и прогресс связанных чек-листов.

Текущий публичный доступ к событиям устроен так:

- `GET /api/equipment-events` и `GET /api/equipment-events/:id` доступны любому авторизованному пользователю;
- `GET /api/equipment-events/responsible-users`, `POST /api/equipment/:visibleId/events/manual`, `PATCH /api/equipment-events/:id` и `POST /api/equipment-events/:id/cancel` доступны только ролям управления через `assertCanManageEquipmentEvents`.

Обычный пользователь не управляет событием напрямую и работает только через назначенный ему чек-лист, но при этом может читать список и карточку событий через текущий публичный API.

## Публичные endpoints событий

```text
GET   /api/equipment-events
GET   /api/equipment-events/:id
GET   /api/equipment-events/responsible-users
POST  /api/equipment/:visibleId/events/manual
PATCH /api/equipment-events/:id
POST  /api/equipment-events/:id/cancel
```

Маршруты:

```text
POST /api/equipment-events/:id/start
POST /api/equipment-events/:id/complete
```

полностью отсутствуют в публичном API.

## Публичные endpoints пользовательских чек-листов

```text
GET   /api/checklists
GET   /api/checklists/:id
POST  /api/checklists/:id/start
PATCH /api/checklists/:id/answers
POST  /api/checklists/:id/complete
```

Именно через эти endpoints пользователь запускает работу, сохраняет промежуточные ответы и завершает чек-лист.

## Жизненный цикл события

```text
CREATED
  ↓ старт первого чек-листа
IN_PROGRESS
  ↓ завершение последнего чек-листа
COMPLETED
```

Дополнительный переход:

```text
CREATED / IN_PROGRESS
        ↓
    CANCELLED
```

## Жизненный цикл экземпляра чек-листа

```text
CREATED
  ↓
IN_PROGRESS
  ↓
COMPLETED
```

Дополнительный переход:

```text
CREATED / IN_PROGRESS
        ↓ отмена события
    CANCELLED
```

`Checklist.isRequired` на уровне экземпляра отсутствует. Обязательность сохраняется только на уровне вопросов `checklist_details.is_required`.

## Бизнес-правила

- у события должен быть хотя бы один ответственный;
- у каждого ответственного внутри события должен быть ровно один чек-лист;
- один шаблон может быть назначен нескольким ответственным;
- событие нельзя начать через чек-лист, если множества responsibles и checklist assignees не совпадают;
- при первом старте все чек-листы события должны быть в статусе `CREATED`;
- при повторном старте достаточно, чтобы текущий чек-лист был `CREATED`, а событие — `IN_PROGRESS`;
- сохранить ответы можно только для чек-листа в `IN_PROGRESS` и только назначенным исполнителем;
- событие завершается только когда все его чек-листы имеют статус `COMPLETED`;
- старое событие без единого чек-листа не может считаться завершённым.

## Формат `checklists[]` в ответе события

Список и карточка события возвращают расширенный массив чек-листов:

```json
{
  "id": 501,
  "checklistTemplateId": 12,
  "templateName": "Ежедневный осмотр",
  "assignedUserId": "user-1",
  "assignedUser": {
    "id": "user-1",
    "fullName": "Иванов Иван Иванович",
    "position": "Механик"
  },
  "status": "IN_PROGRESS",
  "sortOrder": 1,
  "progress": {
    "answered": 3,
    "total": 10,
    "requiredAnswered": 2,
    "requiredTotal": 6
  }
}
```

Прогресс рассчитывается по `checklist_details` и не дублируется в `equipment_events`.

## Формат ответа пользовательского чек-листа

Список и карточка `/api/checklists` возвращают:

- `id`, `status`, `version`, `sortOrder`;
- `assignedUser`;
- `template`;
- `event`;
- `equipment`;
- `progress`;
- для detail — `startedAt`, `completedAt`, `modules[]`, `questions[]`.

Для вопроса сохраняется `isRequired`, потому что обязательность относится к вопросу, а не к экземпляру чек-листа.

## Важные коды ошибок

События:

- `EVENT_NOT_FOUND`
- `EVENT_STATUS_CONFLICT`
- `RESPONSIBLES_REQUIRED`
- `CHECKLISTS_REQUIRED`

Пользовательские чек-листы:

- `CHECKLIST_NOT_FOUND`
- `CHECKLIST_NOT_ASSIGNED`
- `CHECKLIST_STATUS_CONFLICT`
- `CHECKLIST_EVENT_STATUS_CONFLICT`
- `CHECKLIST_EVENT_NOT_IN_PROGRESS`
- `CHECKLIST_VERSION_CONFLICT`
- `CHECKLIST_REQUIRED_ANSWERS_MISSING`
- `CHECKLIST_ASSIGNMENTS_REQUIRED`
- `CHECKLISTS_REQUIRED`
- `SESSION_REQUIRED`

## Основные backend-компоненты

- `equipment-events.controller.ts` — административный API событий;
- `equipment-events.creator.ts` — создание события и экземпляров чек-листов;
- `equipment-events-update.service.ts` — редактирование события в `CREATED`;
- `equipment-events-lifecycle.service.ts` — отмена события;
- `checklist-work.controller.ts` — пользовательский API чек-листов;
- `checklist-work-lifecycle.service.ts` — автозапуск и автозавершение события через lifecycle чек-листа;
- `checklist-work-answers.service.ts` — промежуточное сохранение ответов.
