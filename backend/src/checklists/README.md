# Checklists Admin Backend

Модуль отвечает за административное управление чек-листами оборудования.

## Структура

```text
checklists/
├── checklist-common/
├── checklist-modules/
├── checklist-questions/
└── checklist-templates/
```

## Доступ

Все endpoints требуют роль `admin`. Идентификаторы пользователей для полей
`createdBy`, `updatedBy`, `publishedBy`, `archivedBy` берутся только из сессии.

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
