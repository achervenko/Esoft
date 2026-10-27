# Массовый приход

`WarehouseReceiptsService` проводит приход через общий Stock в одной транзакции.
Ручной HTTP API — адаптер; будущий обработчик 1С вызывает экспортированный
`post(payload, origin, actorUserId)` с разрешённым сервисным пользователем.
Отдельный транспорт/импорт 1С и frontend пока не реализованы.

## Модель

`WarehouseReceipt` хранит склад, источник, идентичность операции, hash,
необязательные номер/дату основания и комментарий, автора, серверное время и
снимки кода/названия склада. `WarehouseReceiptLine` хранит исходный порядок,
товар, место, количество и снимки артикула, названия товара, единицы, кода и
названия места. Карточка использует эти снимки и не переименовывается вслед за
справочниками. Имя автора показывается актуальным из User.

SQL обеспечивает уникальность `(source, source_system, source_operation_id)`,
положительные quantity/row_number и уникальность товара+места и номера строки
в приходе. Количество numeric(14,3), ID bigint. FK RESTRICT сохраняют ссылки.
Схема добавлена в исходную миграцию ещё не установленного warehouse-пакета;
обновлена контрольная сумма manifest. Это не обновление установленной старой БД.

## API и доступ

- `POST /api/warehouse/receipts` — ручное проведение, `warehouse.receipts.manage`.
- `GET /api/warehouse/receipts` — список, `warehouse.receipts.read`.
- `GET /api/warehouse/receipts/:id` — карточка, то же read.

Оба permission назначены admin/storekeeper. Нужна активная сессия.
POST повторно проверяет пользователя, banned и manage под user FOR SHARE внутри
транзакции, в том числе для повторного запроса. PATCH/DELETE отсутствуют.
Успешный POST всегда возвращает 201 с одним контрактом карточки — при первом
проведении и при повторе. Повтор возвращает тот же документ и исходный порядок.

```json
{
  "warehouseId": "1",
  "requestKey": "acbf4fd4-89c4-4f5d-b8f2-150665d3c680",
  "documentNumber": "42",
  "documentDate": "2026-10-27",
  "comment": "Комплектующие",
  "lines": [
    { "itemId": "15", "storageLocationId": "8", "quantity": "20" },
    { "itemId": "15", "storageLocationId": "9", "quantity": "5.125" }
  ]
}
```

1–100 строк, один склад, без повторяющейся пары товар+место. ID — канонические
положительные decimal bigint strings, количества — строки до трёх знаков, > 0.
Числовой JSON quantity запрещён. Строки trim, пустые необязательные — null;
номер до 100, комментарий до 4000 символов. NUL/неизвестные поля запрещены.
Дата основания — существующая YYYY-MM-DD, хранится как DATE. Автор, источник,
время, снимки и rowNumber назначаются сервером; их нельзя передать в ручной API.

`requestKey` — UUID версий 1–8 с RFC variant, регистр нормализуется. Nil/Max UUID
не принимаются. Для MANUAL sourceSystem всегда `ESOFT`, sourceOperationId —
JSON-массив `[actorUserId, normalizedRequestKey]`. Поэтому ключ ограничен автором.
Для ONE_C интеграция передаёт стабильные sourceSystem (база-источник) и
sourceOperationId. Их длины — 1–100 и 1–255 после trim. Автор обязателен: сервисный
User с manage, без автоматического создания/выдачи прав. origin не доступен через HTTP.

Хеш после нормализации включает склад, реквизиты и строки, отсортированные по
числовым itemId/storageLocationId. Decimal нормализован; rowNumber и requestKey
не входят. Перестановка строк/2.000 вместо 2 не создаёт ложный конфликт.
Повтор с другим hash — 409 WAREHOUSE_RECEIPT_REQUEST_CONFLICT.
Идентичность защищена advisory lock в транзакции и уникальным индексом БД.
Успешный повтор проверяется до активности справочников, количество не меняет.

## Проведение и блокировки

ReadCommitted, timeout 15 секунд. Порядок: пользователь → идентичность прихода
(advisory) → склад FOR SHARE → полные Stock locks по всем товарам в числовом
порядке itemId, внутри — места по числовому ID. Все locks получаются до записи.
Затем проверяются активность товара/места и принадлежность выбранному складу,
сохраняются снимки, вызывается receiveStock по тому же порядку, пишется аудит.
Склад должен быть активен; номенклатура и места автоматически не создаются.

Stock создаёт отсутствующие остатки и увеличивает существующие. Резервы не меняются.
Ошибка одной строки, превышение диапазона, ошибка аудита откатывают документ,
все количества и audit. Пользователи, Catalog и структура хранения изменяются
с согласованными row locks. Существующие однотоварные операции Stock используют
тот же порядок; другие будущие массовые writers также обязаны соблюдать его.

Аудит: module WAREHOUSE, entityType warehouse_receipt, entityStringId — строковый
ID, поле «Приход на склад» — карточка со снимками. Stock отдельно аудирует остатки.
Исправление проведённого прихода — существующей admin-корректировкой с основанием;
отдельной отмены, черновиков и автоматического исправления изменённого импорта нет.

## Список и ответы

Параметры: warehouseId, source (MANUAL/ONE_C), itemId, storageLocationId,
createdByUserId, createdFrom, createdTo, search, page, limit. Неизвестные запрещены.
search — буквальный регистронезависимый поиск по documentNumber (до 100 символов),
включая буквальные %, _ и обратный слеш.
Период включительный по createdAt: ISO datetime с часовым поясом Z/±HH:MM,
секундами и необязательными миллисекундами. Дата без времени не принимается.
documentDate не фильтруется. page от 1, limit 1–100, по умолчанию 50;
смещение не больше 2147483647. Сортировка фиксирована createdAt DESC, id DESC.
Товар и место — один lines.some (один EXISTS по одной строке).

Ответ списка `{items,total,page,limit}`. items: id, warehouseId, source,
documentNumber, documentDate, comment, warehouseCodeSnapshot,
warehouseNameSnapshot, createdByUserId, createdBy {id,name}, createdAt, lineCount.
Список/total читаются одним RepeatableRead-снимком, строки не загружаются.
Карточка содержит те же реквизиты (без lineCount) и lines: id, receiptId,
rowNumber, itemId, storageLocationId, quantity, unitSnapshot,
itemArticleSnapshot, itemNameSnapshot, storageLocationCodeSnapshot,
storageLocationNameSnapshot. ID/quantity строковые, createdAt ISO UTC,
documentDate YYYY-MM-DD или null. Техническая идентичность и hash не выдаются.
Сумма количеств разных товаров/единиц не вычисляется.

Основные ошибки: 400 WAREHOUSE_RECEIPT_INVALID (payload/query), ошибки ID/quantity
из Stock; 404 WAREHOUSE_RECEIPT_NOT_FOUND, WAREHOUSE_NOT_FOUND,
WAREHOUSE_ITEM_NOT_FOUND, WAREHOUSE_LOCATION_NOT_FOUND; 409
WAREHOUSE_RECEIPT_REQUEST_CONFLICT, WAREHOUSE_INACTIVE,
WAREHOUSE_RECEIPT_INACTIVE_REFERENCE, WAREHOUSE_RECEIPT_LOCATION_MISMATCH,
WAREHOUSE_STOCK_QUANTITY_OVERFLOW; 403 FORBIDDEN. Инфраструктурные ошибки не маскируются.

## Проверки

```powershell
npm run db:generate
npm run build:backend
npm run test --workspace backend -- --runInBand warehouse receipts optional-warehouse
$env:ESOFT_MODULAR_MIGRATION_TEST = '1'
try {
  node --test tests/scripts/infrastructure/prisma/warehouse-receipts.real.integration.test.mjs
} finally { Remove-Item Env:ESOFT_MODULAR_MIGRATION_TEST }
```

Интеграция создаёт временный PostgreSQL core+warehouse: массовость, decimal/ID,
снимки после переименования, replay после деактивации, конкурентный повтор,
прямые SQL constraints, одна строка EXISTS, откат при переполнении и audit error,
параллельный приход в разном порядке и выдача, актуальные права.
