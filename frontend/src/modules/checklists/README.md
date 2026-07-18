# Административный блок чек-листов

Блок предназначен для:

- управления каталогом модулей;
- управления каталогом вопросов;
- создания и просмотра шаблонов чек-листов;
- формирования структуры шаблона из модулей и вопросов.

> Привязка шаблонов к оборудованию, видам обслуживания и событиям выполняется в другом модуле и в данном README не рассматривается.

Документ описывает только frontend административного блока. Рабочие чек-листы, выполнение работниками, ответы и статусы рабочих экземпляров сюда не входят.

Связанные frontend-документы:

- `../equipment-events/README.md` — события оборудования и назначение рабочих чек-листов;
- `../../pages/my-checklists/README.md` — пользовательский экран выполнения чек-листов.

## Технологии

- React 19;
- TypeScript;
- Vite;
- Chakra UI;
- lucide-react;
- hash-навигация через `window.location.hash` и вспомогательные функции из `shared/lib/hash-navigation`.

Отдельный router для этого блока не используется. Навигация встроена в общий shell приложения.

## Права доступа

Административным блоком могут управлять:

- `admin`;
- `chief_engineer`.

Frontend-проверка выполняется через:

```ts
canManageChecklists(userRole)
```

Реализация находится в [roles.ts](../../shared/lib/roles.ts).

Frontend-проверка не заменяет backend-проверку прав. Для остальных пользователей административная часть недоступна, но это не означает, что весь раздел чек-листов полностью закрыт: рабочая часть чек-листов является отдельной функциональностью.

## Состав блока

Административный блок состоит из двух частей:

1. Шаблоны.
2. Каталог.

### Шаблоны

Поддерживаются:

- просмотр списка;
- поиск и фильтрация;
- создание;
- копирование;
- просмотр;
- удаление;
- добавление модулей;
- добавление вопросов;
- изменение порядка модулей;
- изменение порядка вопросов;
- удаление элементов из структуры;
- изменение обязательности вопросов;
- предпросмотр.

### Каталог

Поддерживаются:

- создание и редактирование модулей;
- активация и деактивация модулей;
- изменение порядка модулей;
- создание и редактирование вопросов;
- активация и деактивация вопросов;
- изменение порядка вопросов;
- работа с вопросами без модуля;
- поиск вопросов.

## Бизнес-модель шаблона

Шаблон является переиспользуемой структурой чек-листа.

При создании шаблон не привязывается:

- к оборудованию;
- к модели оборудования;
- к виду обслуживания;
- к событию.

Привязка выполняется позднее в другом модуле.

Шаблон содержит:

- `name`;
- `description | null`;
- упорядоченный набор модулей;
- упорядоченный набор вопросов внутри каждого модуля;
- `isRequired` для каждого вопроса.

Новый шаблон редактируется локально и сохраняется одной операцией через `createChecklistTemplate(...)`.

После сохранения шаблон открывается только в режиме чтения. Для изменения структуры существующего шаблона пользователь должен создать копию.

## Состояния шаблонов

Во frontend используются только состояния:

```ts
type ChecklistTemplateState = "ACTIVE" | "ARCHIVED";
```

Отображение:

- `ACTIVE` -> `Действующий`;
- `ARCHIVED` -> `Удалённый`.

Технически удаление реализовано через архивирование endpoint `POST /api/checklist-templates/:id/archive`, но в пользовательском интерфейсе операция называется удалением:

- `Удалить шаблон`;
- `Шаблон удалён`;
- `Удалённый`.

Формулировка `архивировать шаблон` для UI этого блока не используется.

Статус `DRAFT` во frontend-типах отсутствует и в пользовательских сценариях текущей версии не используется. Если упоминания `DRAFT` ещё остались в backend или старых обсуждениях, для этого интерфейса они считаются устаревшими техническими следами.

## Модули и вопросы

Структура модуля:

```ts
type ChecklistModule = {
  id: number;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
};
```

Структура вопроса:

```ts
type ChecklistQuestion = {
  id: number;
  questionText: string;
  answerType: ChecklistAnswerType;
  checklistModuleId: number | null;
  sortOrder: number | null;
  isActive: boolean;
};
```

Поддерживаемые типы ответов:

```ts
type ChecklistAnswerType =
  | "BOOLEAN"
  | "INTEGER"
  | "DECIMAL"
  | "TEXT"
  | "DATE";
```

Отображаемые значения:

- `BOOLEAN` -> `Да / Нет`;
- `INTEGER` -> `Целое число`;
- `DECIMAL` -> `Десятичное число`;
- `TEXT` -> `Текст`;
- `DATE` -> `Дата`.

Типы и подписи объявлены в [checklists.types.ts](../../shared/api/checklists/checklists.types.ts).

## Вопросы без модуля

Вопрос может не принадлежать модулю:

```ts
checklistModuleId: number | null;
sortOrder: number | null;
```

Такие вопросы показываются отдельной группой `Без модуля`.

При определении принадлежности вопроса к модулю нужно использовать:

```ts
question.checklistModuleId
```

Не следует строить бизнес-логику только на:

```ts
question.module?.id
```

`question.module` является дополнительными данными для отображения и может отсутствовать.

Текущая реализация использует `question.checklistModuleId` как основной источник связи вопроса с модулем. Новую логику для editor и каталога тоже нужно писать через `question.checklistModuleId`.

## Активация и деактивация

Правила каталога:

- неактивный модуль нельзя использовать при создании нового шаблона;
- неактивный вопрос нельзя добавлять в новый шаблон;
- при деактивации модуля связанные активные вопросы локально помечаются неактивными;
- при каскадной деактивации вопросы сохраняют `checklistModuleId`;
- вопросы сохраняют своё `sortOrder`;
- существующие шаблоны не меняются из-за деактивации элементов каталога.

Деактивация не является удалением сущности.

## Создание шаблона

Последовательность:

1. Открывается `#/checklist-admin/templates/new`.
2. Пользователь задаёт название и описание.
3. В левой панели отображаются доступные активные модули.
4. Модуль добавляется в структуру.
5. Пользователь выбирает вопросы модуля.
6. Модули и вопросы можно переупорядочивать.
7. Для вопросов можно менять обязательность.
8. Перед сохранением можно открыть предпросмотр.
9. Шаблон сохраняется одной операцией.

`name` обязателен. `description` необязателен.

Сохранение вызывает `createChecklistTemplate(...)` и сразу создаёт действующий шаблон. Отдельного шага публикации нет.

## Копирование шаблона

Копирование:

- загружает структуру существующего шаблона;
- создаёт новый локально редактируемый шаблон;
- не изменяет исходный шаблон;
- позволяет изменить название, описание и структуру;
- после сохранения создаёт новую самостоятельную сущность.

Маршрут:

```text
#/checklist-admin/templates/new?copyFrom=:id
```

Внутри editor это обрабатывается через `copyFromTemplateId`.

Важно: при копировании локальное состояние помечается dirty сразу после загрузки исходного шаблона. Это фактическое поведение `useLocalTemplateState`.

## Просмотр шаблона

Существующий шаблон открывается в режиме чтения на маршруте:

```text
#/checklist-admin/templates/:id
```

Доступные действия:

- возврат к списку;
- просмотр структуры;
- копирование;
- удаление действующего шаблона.

Кнопки редактирования и сохранения для существующего шаблона не отображаются. Во внутренней логике это закреплено через `isEditable = templateId === null`.

## Удаление шаблона

Пользовательский сценарий:

1. Пользователь нажимает `Удалить`.
2. Открывается `ConfirmDialog`.
3. После подтверждения вызывается endpoint архивирования.
4. После успешной операции пользователь возвращается к списку.

Последствие:

> Шаблон нельзя использовать для новых событий, но уже созданные события и чек-листы не изменяются.

Дополнительно:

- архивирование может удалить привязки этого шаблона как `defaultChecklistTemplate` из настроек обслуживания;
- backend возвращает количество снятых привязок в поле `removedMaintenanceSettingLinks`;
- frontend должен учитывать, что после удаления шаблона связанные maintenance settings могут остаться без default-шаблона.

Удаление не является физическим удалением записи из базы данных.

## Drag-and-drop

В редакторе шаблона поддерживаются:

- добавление модуля из каталога;
- изменение порядка модулей;
- изменение порядка вопросов;
- удаление модуля через drop-зону;
- удаление вопроса через drop-зону.

Также поддерживаются:

- контекстное меню для структуры;
- удаление клавишей `Delete`;
- открытие контекстного меню через `Shift + F10`;
- добавление модуля из каталога клавишами `Enter` или `Space`.

В каталоге поддерживается альтернативное клавиатурное управление порядком:

- `Alt + ArrowUp`;
- `Alt + ArrowDown`.

Фактические технические правила:

- вложенные кнопки не должны запускать drag; для этого используются `data-no-drag="true"` и `stopCardEvent(...)`;
- после завершения операции снимается `pointer capture`;
- глобальные listeners очищаются в cleanup;
- активный `requestAnimationFrame` отменяется;
- drop-индексы считаются отдельно для модулей и вопросов, с поправкой на перемещение вверх и вниз через `calculateReorderTargetIndex(...)`.

DnD реализован собственной логикой. Отдельная библиотека drag-and-drop не используется.

## Изменение порядка в каталоге

Правила:

- порядок модулей задаётся через `sortOrder`;
- порядок вопросов внутри модуля задаётся через `sortOrder`;
- после локального перемещения порядок нормализуется с `1`;
- backend получает полный список элементов с новыми позициями;
- при ошибке frontend восстанавливает предыдущее состояние.

Отдельно:

> При активном поиске изменение порядка вопросов отключается, потому что пользователь видит отфильтрованный, а не полный список.

Это реализовано в `useChecklistCatalogReorder`: `reorderQuestions(...)` не выполняется, если `questionSearch.trim()` не пустой.

## Optimistic update

Оптимистически обновляются:

- изменение порядка модулей;
- изменение порядка вопросов.

Для этих операций frontend:

- сохраняет предыдущее состояние;
- локально применяет новый порядок до ответа backend;
- при успехе заменяет состояние ответом backend;
- при ошибке откатывается к предыдущему состоянию.

Для активации и деактивации:

- повторное действие для той же сущности блокируется через `pendingModuleIds` и `pendingQuestionIds`;
- loading локален для конкретной сущности;
- состояние обновляется после ответа backend, без полного reload списка.

Создание и редактирование элементов каталога работают без отдельного полного reload: состояние обновляется через `upsertModule(...)` и `upsertQuestion(...)`.

## Загрузка данных и защита от устаревших запросов

В loader-хуках используется `requestIdRef`.

Зафиксированные правила:

- при смене `templateId` старый запрос не должен перезаписывать новые данные;
- при смене `copyFromTemplateId` старый запрос игнорируется;
- при потере административных прав loader редактора очищает шаблон, модули, вопросы и ошибку;
- loading завершается только для актуального запроса;
- каталог и список шаблонов также игнорируют устаревшие ответы.

Для загрузки вопросов в редактор используется набор ID активных модулей и поле:

```ts
question.checklistModuleId
```

В редактор попадают только активные модули и активные вопросы, привязанные к активным модулям.

## Навигация

Основные hash-маршруты:

```text
#/checklist-admin
#/checklist-admin?tab=catalog
#/checklist-admin/templates/new
#/checklist-admin/templates/new?copyFrom=:id
#/checklist-admin/templates/:id
```

Назначение:

- `#/checklist-admin` -> вкладка шаблонов;
- `#/checklist-admin?tab=catalog` -> каталог модулей и вопросов;
- `#/checklist-admin/templates/new` -> создание нового шаблона;
- `#/checklist-admin/templates/new?copyFrom=:id` -> создание копии шаблона;
- `#/checklist-admin/templates/:id` -> просмотр сохранённого шаблона.

Для совместимости старые query-параметры `questions`, `modules` и `order` перенаправляются на вкладку `catalog`. Это фактическое поведение `getInitialTab()` в `ChecklistAdminPage.tsx`.

## Frontend API

Используемые функции расположены в [checklists.api.ts](../../shared/api/checklists/checklists.api.ts).

Важно: `shared/api/checklists/` больше не относится только к административному блоку. В этой папке находятся:

- административные запросы и типы для модулей, вопросов и шаблонов;
- запросы и типы пользовательских рабочих чек-листов для экрана `Мои чек-листы`;
- общие преобразования ошибок для административной части.

### Модули

```text
GET    /api/checklist-modules
POST   /api/checklist-modules
PATCH  /api/checklist-modules/:id
POST   /api/checklist-modules/:id/activate
POST   /api/checklist-modules/:id/deactivate
PATCH  /api/checklist-modules/reorder
```

### Вопросы

```text
GET    /api/checklist-questions
POST   /api/checklist-questions
PATCH  /api/checklist-questions/:id
POST   /api/checklist-questions/:id/activate
POST   /api/checklist-questions/:id/deactivate
PATCH  /api/checklist-modules/:moduleId/questions/reorder
```

### Шаблоны

```text
GET    /api/checklist-templates
GET    /api/checklist-templates/:id
POST   /api/checklist-templates
POST   /api/checklist-templates/:id/archive
```

Создание шаблона сразу создаёт действующий шаблон. Отдельного этапа публикации нет.

## Структура frontend-модуля

Фактический код административного блока не собран в одной runtime-директории. Он разделён между страницами и общим API-слоем. Этот README размещён в `src/modules/checklists/README.md` как отдельная точка входа в документацию.

```text
src/
├── modules/
│   └── checklists/
│       └── README.md
├── pages/
│   ├── ChecklistAdminPage/
│   │   ├── ChecklistAdminPage.tsx
│   │   ├── ChecklistAdminPanels.tsx
│   │   ├── TemplatesPanel.tsx
│   │   ├── CatalogPanel.tsx
│   │   ├── CatalogModulesColumn.tsx
│   │   ├── CatalogQuestionsColumn.tsx
│   │   ├── CatalogModuleCard.tsx
│   │   ├── CatalogQuestionCard.tsx
│   │   ├── CatalogUnassignedCard.tsx
│   │   ├── ChecklistAdminModals.tsx
│   │   ├── ModuleFormModal.tsx
│   │   ├── QuestionFormModal.tsx
│   │   ├── useChecklistCatalog.ts
│   │   ├── useChecklistCatalogLoader.ts
│   │   ├── useChecklistCatalogMutations.ts
│   │   ├── useChecklistCatalogReorder.ts
│   │   ├── useChecklistCatalogSelection.ts
│   │   ├── useChecklistTemplates.ts
│   │   ├── useCatalogReorderDrag.ts
│   │   ├── checklist-admin.types.ts
│   │   ├── checklist-admin.constants.ts
│   │   ├── checklist-catalog.types.ts
│   │   ├── checklist-catalog.state.ts
│   │   ├── checklist-catalog.selectors.ts
│   │   ├── checklist-catalog.order.ts
│   │   ├── catalog-reorder.types.ts
│   │   ├── catalog-reorder.helpers.ts
│   │   ├── ChecklistAdminPage.css
│   │   ├── checklist-admin-layout.css
│   │   ├── checklist-admin-status.css
│   │   ├── checklist-catalog.css
│   │   └── checklist-order.css
│   ├── ChecklistTemplateEditorPage/
│   │   ├── ChecklistTemplateEditorPage.tsx
│   │   ├── ChecklistTemplateEditorHeader.tsx
│   │   ├── ChecklistTemplateEditorModals.tsx
│   │   ├── AvailableModulesPanel.tsx
│   │   ├── TemplateModuleSection.tsx
│   │   ├── PreviewModal.tsx
│   │   ├── AddModuleModal.tsx
│   │   ├── AddQuestionModal.tsx
│   │   ├── useChecklistTemplateEditor.ts
│   │   ├── useChecklistTemplateLoader.ts
│   │   ├── useTemplatePersistence.ts
│   │   ├── useTemplateStructureActions.ts
│   │   ├── useTemplateStructureInteractions.ts
│   │   ├── useTemplateDragAndDrop.ts
│   │   ├── useTemplateEditorExitGuard.ts
│   │   ├── useLocalTemplateState.ts
│   │   ├── template-editor-selectors.ts
│   │   ├── template-drop-position.ts
│   │   ├── template-structure.types.ts
│   │   ├── checklist-template-editor.catalog.ts
│   │   ├── checklist-template-editor.factory.ts
│   │   ├── checklist-template-editor.normalize.ts
│   │   ├── checklist-template-editor-order.ts
│   │   ├── ChecklistTemplateEditorPage.css
│   │   ├── PreviewModal.css
│   │   └── template-drag-and-drop/
│   │       ├── use-template-drag-and-drop.ts
│   │       ├── use-template-drag-events.ts
│   │       ├── template-drag-and-drop.types.ts
│   │       ├── template-drag-hit-testing.ts
│   │       ├── template-drag-indexes.ts
│   │       └── template-drag-preview.ts
│   └── ChecklistTemplateViewPage/
│       ├── ChecklistTemplateViewPage.tsx
│       └── ChecklistTemplateViewPage.css
└── shared/
    └── api/
        └── checklists/
            ├── checklists.api.ts
            ├── checklists.types.ts
            ├── checklist-admin-errors.ts
            └── index.ts
```

Ответственность крупных частей:

- `ChecklistAdminPage/` -> список шаблонов и каталог;
- `ChecklistTemplateEditorPage/` -> создание, копирование, локальное редактирование и drag-and-drop;
- `ChecklistTemplateViewPage/` -> просмотр сохранённого шаблона и удаление;
- `shared/api/checklists/` -> общий frontend API-слой чек-листов: административные сущности, рабочие чек-листы и связанные типы.

## Основные хуки

`useChecklistCatalog`
Объединяет state каталога, загрузку, мутации, выбор текущей группы и изменение порядка.

`useChecklistCatalogLoader`
Загружает все модули и вопросы каталога с защитой от stale requests.

`useChecklistCatalogMutations`
Создаёт, редактирует, активирует и деактивирует элементы каталога.

`useChecklistCatalogReorder`
Делает optimistic reorder модулей и вопросов и откатывает состояние при ошибке.

`useChecklistCatalogSelection`
Собирает производные данные каталога: активные модули, выбранную группу, вопросы группы и счётчики.

`useChecklistTemplates`
Загружает список шаблонов с поиском и фильтром по `state`.

`useChecklistTemplateEditor`
Собирает editor из loader, локального state, структурных действий и сохранения.

`useChecklistTemplateLoader`
Загружает активный каталог для editor и, при необходимости, исходный шаблон для просмотра или копирования.

`useTemplatePersistence`
Сохраняет новый шаблон, переводит пользователя на страницу просмотра и поддерживает переход в режим копирования.

`useTemplateStructureActions`
Описывает локальные операции со структурой шаблона: модули, вопросы, обязательность и порядок.

`useTemplateDragAndDrop`
Управляет drag-and-drop структуры шаблона и очисткой pointer capture и overlay.

`useTemplateEditorExitGuard`
Блокирует уход со страницы при несохранённых изменениях.

## Выход из редактора

При несохранённых изменениях переход со страницы требует подтверждения.

Фактическая логика:

- используется признак `isDirty`;
- целевой переход сохраняется в `pendingExitHref`;
- после подтверждения вызывается `exitEditor(pendingExitHref)`;
- при отмене пользователь остаётся в редакторе.

Защита работает для:

- `hashchange`;
- кликов по ссылкам;
- `beforeunload`.

## Обработка ошибок

Единый преобразователь ошибок:

```ts
getChecklistAdminErrorMessage()
```

Он расположен в [checklist-admin-errors.ts](../../shared/api/checklists/checklist-admin-errors.ts).

Правила:

- ошибка действия показывается пользователю;
- при успешной мутации и неуспешном reload нужно разделять ошибку действия и ошибку обновления списка;
- ошибка обновления списка не должна маскироваться под ошибку самой мутации;
- диалог удаления шаблона показывает ошибку внутри диалога;
- модальные окна каталога и editor не должны закрываться при неуспешном сохранении.

Фактическое замечание:

- в просмотре шаблона ошибка удаления уже показывается внутри `ConfirmDialog`;
- в editor ошибка сохранения остаётся на странице и не закрывает модальные окна;
- в каталоге часть мутаций обновляет состояние локально без отдельного reload, поэтому разделение ошибок reload и action актуально для будущих доработок.

## Известные ограничения текущей версии

- существующий шаблон нельзя редактировать;
- для изменения используется копирование;
- статус `DRAFT` не используется во frontend-сценариях;
- назначение шаблона на события отсутствует в этом модуле;
- рабочее выполнение чек-листов отсутствует в этом модуле;
- файлы и вложения в вопросах не поддерживаются;
- условная логика вопросов не поддерживается;
- drag-and-drop реализован собственной логикой, без отдельной DnD-библиотеки;
- автоматические frontend-тесты для этих страниц и хуков отсутствуют.

## Правила дальнейшей разработки

- не использовать `question.module?.id` как единственный источник связи;
- учитывать вопросы без модуля;
- не возвращать `DRAFT` в пользовательские сценарии;
- не называть удаление архивированием в UI;
- не разрешать редактирование сохранённого шаблона;
- не смешивать административный модуль с назначением шаблонов;
- сохранять optimistic rollback для reorder;
- защищаться от stale requests;
- блокировать изменение порядка при фильтрации списка;
- соблюдать проверки ролей и на frontend, и на backend.
