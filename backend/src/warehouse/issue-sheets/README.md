# IssueSheets

Backend-компонент заданий на выдачу. Использует существующие `WarehouseIssueSheet`,
`WarehouseIssueSheetLine`, `WarehouseIssue`, `WarehouseIssuePosition` пакета warehouse.
Новых таблиц и миграций не требует. Физический остаток, резервы и выбор мест фактической
выдачи не изменяет. UI и импорт файлов не входят в этот компонент: исходные поля
принимаются подготовленными данными.

## Доступ и структура

Все маршруты требуют активную сессию и `warehouse.issue-sheets.manage` (admin,
storekeeper, в том числе совмещённые роли). На каждой мутации роль и блокировка
пользователя повторно проверяются под `FOR SHARE` в той же транзакции.
Без подключённого database package warehouse маршрутов нет.

- `issue-sheets.service.ts`: фасад для controller и будущего Issues.
- `issue-sheets-lines.service.ts`: строки, ссылки, запрет изменения начатых строк.
- `issue-sheets-lifecycle.service.ts`: создание, готовность, отмена, финализация.
- `issue-sheets-execution.service.ts`: транзакционный контракт с Issues.
- `issue-sheets-query.service.ts`: SQL-фильтры и прогресс по реальным выдачам.
- `issue-sheets-transaction.service.ts`: блокировка листа, доступ, общий аудит.
- `issue-sheets.validation.ts`, `issue-sheets.model.ts`: входной контракт и DTO.

## API

Префикс `/api/warehouse/issue-sheets`:

| Метод  | Путь                 | Операция                       |
| ------ | -------------------- | ------------------------------ |
| POST   | `/`                  | Создание DRAFT                 |
| GET    | `/`                  | Список листов                  |
| GET    | `/:id`               | Карточка без строк             |
| GET    | `/:id/lines`         | Строки с прогрессом            |
| POST   | `/:id/lines`         | Добавление строки              |
| PATCH  | `/:id/lines/:lineId` | Изменение бизнес-данных строки |
| DELETE | `/:id/lines/:lineId` | Удаление неначатой строки      |
| POST   | `/:id/ready`         | Проверка готовности и READY    |
| POST   | `/:id/finalize`      | Расчёт финального результата   |
| POST   | `/:id/cancel`        | Отмена до начала выдачи        |

Для ready/finalize/cancel body пустой `{}`. Передача статуса запрещена.
Автор и время создания/завершения определяются сервером.

Создание: `{ name, sourceFileName?, sourceFileHash? }`. Имя и имя файла до 255
символов, hash — SHA-256 из 64 hex-символов. Hash нормализуется в нижний регистр,
но не является уникальным: повторный импорт сам по себе не запрещён.

Добавление строки: `{ rowNumber, quantity, itemId?, storageLocationId?, projectId?,
unitSnapshot?, sourceArticle?, sourceName?, sourceLocation?, sourceProject?,
matchingStatus?, error? }`.
Номера строк положительные и уникальны в листе, автоматической перенумерации нет.
ID — десятичные строки PostgreSQL bigint. Количества — положительные десятичные
строки с точностью до 3 знаков, максимум `99999999999.999`; JS number не принимается.
В DTO ID и количества тоже строки.

`matchingStatus`: `UNMATCHED` (по умолчанию), `MATCHED`, `ERROR`.
Исходные поля и rowNumber неизменяемы после создания. PATCH принимает только
itemId, storageLocationId, projectId, quantity, unitSnapshot, matchingStatus, error.
Обнуление необязательных полей — `null`.
Ссылки должны существовать и быть активными. Место и проект необязательны;
снимок единицы по умолчанию берётся из номенклатуры, явный отличный снимок запрещён.
При замене номенклатуры без явного snapshot берётся её единица.
Неизвестные поля, пустой PATCH и некорректные диапазоны отклоняются.

## Списки и прогресс

GET списка принимает все фильтры ТЗ: statuses, createdByUserId, processedByUserId,
projectId, itemId, hasErrors, hasUnmatchedLines, hasShortage, sourceFileHash,
createdFrom/createdTo, processedFrom/processedTo, search, sortBy, sortOrder, page, limit.
Статусы можно передать повторёнными query-параметрами или через запятую.
Булевы фильтры принимают true/false и учитывают обе величины.
Поиск без учёта регистра по name/sourceFileName, символы `%`, `_`, `\` буквальные.
Фильтры projectId/itemId проверяют наличие подходящей строки в листе.
hasErrors: есть непустая error или matchingStatus=ERROR;
hasUnmatchedLines: matchingStatus не MATCHED или отсутствует itemId;
hasShortage: хотя бы в одной строке фактически выдано меньше требуемого,
включая листы, по которым выдача ещё не начиналась.
Сортировки: createdAt (по умолчанию DESC), processedAt, name, status; ID разрешает
ничьи, null processedAt идут последними.

GET строк принимает matchingStatuses, itemId, projectId, storageLocationId,
hasError, executionState, rowFrom/rowTo, sortBy, sortOrder, page, limit.
По умолчанию rowNumber ASC. executionState: NOT_STARTED, PARTIAL, COMPLETED, ALL.
Оба списка: `{ items, total, page, limit }`, page по умолчанию 1, limit 50,
максимум 100. Фильтрация, подсчёт и пагинация выполняются в БД; список и total
читаются в одном RepeatableRead-снимке. Даты — ISO, диапазоны включительные;
дата без времени означает полночь UTC, для конца полного дня передавайте время.

Каждая строка возвращает requiredQuantity, issuedQuantity, remainingQuantity,
executionState. issued — сумма quantity позиций всех WarehouseIssue строки,
а не количество документов. NOT_STARTED при 0, PARTIAL между 0 и required,
COMPLETED при полном количестве. Несколько выдач и дробные количества поддержаны.

## Жизненный цикл

DRAFT -> READY: непустой лист, все строки MATCHED, itemId задан, количество
положительное, ошибок нет, ссылки доступны. Изменение/добавление/удаление строки
READY-листа переводит его обратно в DRAFT для повторной проверки.

READY -> IN_PROGRESS: первая фактическая выдача через контракт Issues.
По IN_PROGRESS можно исправлять только строки без единой WarehouseIssue;
начатые строки неизменяемы даже при нулевом количестве позиций операции.
Добавление новых строк в IN_PROGRESS на текущем этапе также разрешено.
Это текущее правило может быть отдельно ужесточено в дальнейшем.

Финализация разрешена из READY/IN_PROGRESS. Клиент не выбирает результат:
все remaining=0 -> PROCESSED, иначе PROCESSED_WITH_SHORTAGE. Заполняются processedAt
и processedByUserId. Финализация не выполняет складских операций и не создаёт
обязательств на недобор. Повторная финализация возвращает прежний результат,
не меняет дату/автора и не создаёт повторного аудита.

Отмена разрешена из DRAFT/READY, только если выдач нет. Повторная отмена идемпотентна.
PROCESSED, PROCESSED_WITH_SHORTAGE, CANCELLED закрыты для строк и новых выдач.
Создание, изменения строк и статусов записываются в общий аудит WAREHOUSE,
entityType=warehouse_issue_sheet, entityStringId — ID листа. Ошибка аудита
откатывает изменение, включая складские изменения callback Issues.

## Контракт с Issues

Самостоятельного backend-сервиса Warehouse Issues в проекте пока нет. Для его
подключения экспортирован `WarehouseIssueSheetsService.executeIssueForLine`:

```ts
await prisma.$transaction(
  (tx) =>
    sheets.executeIssueForLine(
      tx,
      lineId,
      itemId,
      quantity,
      actorUserId,
      async (line) => {
        // Здесь Issues проверяет резервы/остатки, вызывает Stock и создаёт
        // WarehouseIssue с issueSheetLineId=line.id, projectId=line.projectId
        // и WarehouseIssuePosition по выбранным фактическим местам.
        return issue;
      },
    ),
  { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
);
```

Метод принимает только transaction client с уровнем ReadCommitted и проверяет
фактический уровень через current_setting('transaction_isolation'). Другие уровни
отклоняются с WAREHOUSE_ISSUE_SHEET_ISOLATION_REQUIRED до вызова callback:
фиксированный снимок RepeatableRead может устареть за время ожидания блокировки.
Изменение строк допускается только в известных открытых состояниях DRAFT, READY,
IN_PROGRESS; неизвестный статус также запрещает изменение.
Лист блокируется FOR UPDATE до
чтения прогресса и остаётся заблокированным до commit. Сначала проверяется remaining,
после callback проверяются точное приращение количества, тип ISSUE_SHEET,
номенклатура всех позиций и проект. Ошибка должна выйти из транзакции: вызывающий
Issues не должен её проглатывать. Порядок блокировок: пользователь -> лист ->
номенклатура/места -> остатки. Все будущие writers выдач по листу обязаны пользоваться
этим контрактом; прямые Prisma/SQL-записи не обходят его автоматически.
Отмена, изменение строк, финализация и параллельные выдачи сериализованы одним
sheet lock; перевыдача и выдача после закрытия предотвращаются.

## Проверки

```powershell
npm run build:backend
npm run test --workspace backend -- --runInBand warehouse/issue-sheets
$env:ESOFT_MODULAR_MIGRATION_TEST = '1'
try {
  node --test tests/scripts/infrastructure/prisma/warehouse-issue-sheets.real.integration.test.mjs
} finally {
  Remove-Item Env:ESOFT_MODULAR_MIGRATION_TEST
}
```

Интеграционный тест создаёт отдельный временный PostgreSQL только с core+warehouse,
проверяет несколько выдач, фильтры, точность Decimal, статусы, запреты, аудит/откат
и конкурирующие выдачи/финализацию. Рабочую базу не использует.
