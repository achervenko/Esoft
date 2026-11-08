# Stock: API и форматы данных

Контракты чтения физических остатков и агрегированного представления.
Архитектура — в [README](README.md), изменения остатков — в
[транзакционном контракте](STOCK-TRANSACTIONS.md).

## HTTP API физических остатков

Все маршруты требуют сессию и `warehouse.stock.read` (admin/storekeeper).
При выключенном `warehouse` маршруты отсутствуют.

- `GET /api/warehouse/stock` — `{items,total,page,limit}` с фильтрами ниже.
- `GET /api/warehouse/stock/items/:itemId/total?warehouseId=...` — `{itemId,quantity}`.
  Необязательный query-параметр `warehouseId` ограничивает сумму местами выбранного склада;
  без него считается сумма по всем складам. Неактивные места также учитываются.
  `itemId` и `quantity` — строки; `warehouseId` в ответ не включается.
  Для существующей номенклатуры без подходящих остатков — `"0"`,
  для отсутствующей — 404 `WAREHOUSE_ITEM_NOT_FOUND`.
- `GET /api/warehouse/stock/items/:itemId/locations/:locationId` — `{balance}`;
  при отсутствии записи `{balance:null}`, сохранённый нулевой остаток возвращается
  полноценным объектом с `quantity:"0"`.

ID строго канонические положительные decimal bigint strings: ведущие нули,
знаки и пробелы запрещены (400 `WAREHOUSE_STOCK_ID_INVALID`).
HTTP query преобразуется отдельно через `parseStockHttpQuery`: `page/limit` —
целые строки, `itemActive/locationActive` — строго `true|false`, количества —
десятичные строки. `itemIds/locationIds` принимают повторённые параметры или
один список через запятую. Неизвестные, некорректные и конфликтующие фильтры
отклоняются с 400. По умолчанию выдаются положительные остатки без фильтра активности.
Это физические остатки; распределение с учётом резервов предоставляет `stock-overview`.
POST/PATCH/DELETE остатков не предоставляются; чтение не аудируется.

## Внутренний API чтения

- `getBalances(filters?)` возвращает `{ items, total, page, limit }`.
- `getBalance(itemId, locationId)` возвращает остаток или `null`. Отсутствующая
  запись не подменяется объектом с нулевым количеством.
- `getItemTotal(itemId, warehouseId?, tx?)` возвращает сумму строкой: по всем складам
  или по выбранному `warehouseId`. Для фильтра без транзакции передайте
  `getItemTotal(itemId, warehouseId)`. Для существующей номенклатуры
  без подходящих остатков — `"0"`, для отсутствующей — `WAREHOUSE_ITEM_NOT_FOUND`.

## ID, количества и DTO баланса

Все ID принимаются и возвращаются десятичными строками PostgreSQL bigint,
без преобразования в JS number. В DTO остатка есть `id`, `itemId`, `locationId`,
`quantity`, `item` (артикул, название, единица, активность) и `location`
(id/name/isActive/warehouseId/warehouse). Вложенный `location.warehouse`
содержит `id`, `name`, `isActive`; используется общий `locationWithWarehouseDto`.
Все ID вложенных объектов, включая `warehouseId` и `warehouse.id`, также строковые.

Количество принимается строкой или `Prisma.Decimal`, возвращается строкой.
JS number не принимается. Количество операции строго положительно, до трёх
знаков после запятой, максимум `99999999999.999`. Лишняя точность отклоняется,
а не округляется. Итог отдельного остатка ограничен тем же максимумом;
сумма по нескольким местам может его превышать. Все количества выражены
в базовой единице номенклатуры, конвертаций нет.

## Чтение и фильтры

`BalanceFilters` поддерживает:

- `warehouseId`: каноническая положительная bigint-строка; ограничивает остатки
  местами выбранного склада. Без фильтра возвращаются остатки всех складов.
  Совмещается с остальными фильтрами через AND.

- `itemId` либо `itemIds`, `locationId` либо `locationIds`. Одиночный и множественный
  фильтры одной сущности одновременно запрещены. Массивы содержат 1–1000 ID,
  дубликаты нормализуются; разные фильтры объединяются через AND.
- `quantityState`: `POSITIVE` (по умолчанию, `> 0`), `ZERO` (`= 0`), `ALL`.
- `minQuantity`, `maxQuantity`: включительные границы, допускают ноль,
  применяются вместе с `quantityState`; минимум не может превышать максимум.
- `itemActive`, `locationActive`: boolean; без них активность не фильтруется.
- `sortBy`: `item` (артикул, по умолчанию), `location` (название места), `quantity`.
- `sortOrder`: `asc` (по умолчанию) или `desc`; дополнительный ключ — ID остатка
  по возрастанию, в том числе при одинаковых артикулах, местах или количествах.
- `page`: положительное целое, по умолчанию 1; `limit`: 1–100, по умолчанию 50.
  Смещение ограничено 2147483647. Неизвестные поля отклоняются.

Это внутренний TypeScript-контракт: boolean и параметры страницы передаются
типизированными значениями, количества — строкой или Decimal.
HTTP-контроллер отдельно разбирает строковые query-параметры через
`parseStockHttpQuery` перед передачей фильтров во внутренний контракт
`parseBalanceFilters`.

Без переданной транзакции список с количеством записей и сумма с проверкой
существования номенклатуры читаются в `RepeatableRead`. Методы чтения принимают
необязательный `tx`: `getBalances(filters?, tx?)`, `getBalance(itemId, locationId, tx?)`,
`getItemTotal(itemId, warehouseId?, tx?)`. Тогда используется снимок и уровень
изоляции вызывающей транзакции, в том числе её незавершённые изменения.

## Агрегированное представление остатков

Фильтры читаются через `GET /api/warehouse/stock-overview/filters/warehouses`
и `GET /api/warehouse/stock-overview/filters/storage-locations`: достаточно
`warehouse.stock.read`, дополнительное `warehouse.storage-locations.read` не требуется.
Параметры, пагинация и DTO совпадают со списками справочников. Административные
endpoints справочников сохраняют собственные разрешения.

Используется экраном «Остатки» для представления физических остатков по товару и складу.

`GET /api/warehouse/stock-overview` использует `warehouse.stock.read`. Одна строка —
товар + склад. Возвращает `{items,total,page,limit}`; `total` считает эти группы,
а не отдельные балансы. DTO строки: `id` (itemId:warehouseId), `item`, `warehouse`,
`quantity` (decimal-строка), `locationsCount` (места с положительным количеством или записью резерва),
`locationsPreview` (до трёх мест с quantity). `item.photo` возвращает `null`: фотографии
номенклатуры текущим контрактом не поддерживаются. `/stock` возвращает отдельные балансы.

Фильтры: `search` (частичное совпадение article/name без учёта регистра, до 255
символов, SQL wildcard-символы буквальные), `warehouseId`, `locationId`,
`quantityState=POSITIVE|ZERO|ALL` (по умолчанию POSITIVE), `page` (по умолчанию 1),
`limit` (по умолчанию 50, максимум 100).
`sortBy=article|name|quantity|warehouse`, `sortOrder=asc|desc`; по умолчанию article ASC.
Дополнительные ключи itemId/warehouseId по возрастанию обеспечивают стабильную пагинацию.

`POSITIVE` включает группы с положительной суммой физического количества **или**
записью резерва на одном из балансов, в том числе полностью заимствованного.
`ZERO` включает группы с нулевой физической суммой независимо от резервов;
`ALL` не ограничивает группы по количеству. Поэтому POSITIVE и ZERO могут пересекаться.

Фильтр места отбирает группы с балансом в этом месте (для POSITIVE — положительным),
но quantity и распределение всегда охватывают весь соответствующий склад.
Отсутствующий баланс не превращается в нулевой. Неактивные справочники не скрывают
физические остатки. Все чтения ответа выполняются в RepeatableRead-транзакции.

### Распределение по местам и резервы

`GET /api/warehouse/stock-overview/items/:itemId/warehouses/:warehouseId` возвращает
`item`, `warehouse`, `totalQuantity` и полный массив `locations`. Каждая запись
содержит `balanceId`, `location`, `quantity`, `reserved`, `available`, `shortage`,
`physicalShortage` и `reservations`. Отсутствующий товар или склад даёт
404 `WAREHOUSE_STOCK_NOT_FOUND`. Нулевые и неактивные места с балансами включаются.

Все количества возвращаются decimal-строками. Для одного места используются:

- `physical = quantity` — физический остаток;
- `demand = SUM(reservations.quantity)` — полная потребность проектов;
- `borrowed = SUM(reservations.borrowedQuantity)` — заимствованная часть;
- `reserved = demand - borrowed` — часть потребности за вычетом заимствований;
- `available = MAX(physical - reserved, 0)` — свободное физическое количество;
- `physicalShortage = MAX(reserved - physical, 0)` — физический дефицит относительно `reserved`;
- `shortage = MAX(borrowed, demand - physical, 0)` — нехватка с учётом заимствований.

Резерв содержит `id`, `projectId`, `projectNumber`, `projectName`, `quantity`,
`borrowedQuantity` и `movableQuantity`. Для отдельного резерва с
`backed = quantity - borrowedQuantity`:

```text
movableQuantity = MAX(0, MIN(backed, physical - (reserved - backed)))
```

Это ограничение доступного для переноса количества; оно не изменяет резерв.
`totalQuantity` — сумма физических остатков всех мест выбранного товара и склада.

Изменение распределения выполняется через [Transfers](../transfers/README.md).
Проведение требует `warehouse.transfers.manage`, перенос резерва — также
`warehouse.reservations.manage`. Просмотр распределения требует только `warehouse.stock.read`.

### Выполнение агрегированного запроса

Группы вычисляются один раз в материализованном CTE; общий счётчик и страница
читают этот результат. `total` возвращается и для страницы за пределами списка.
Соединение с номенклатурой внутри группировки выполняется только при поиске.
Поиск `ILIKE` по article/name поддержан отдельными GIN/trigram-индексами;
выбор индекса зависит от селективности запроса и плана PostgreSQL.

Гидратация товаров, складов и превью выполняется для выбранной страницы в той же
транзакции. Превью сортируется по названию места и ID баланса; при наличии мест
с положительным количеством или резервами выбираются только такие места. Если
их нет, превью может содержать сохранённые нулевые балансы.

## Ошибки

Ошибки содержат `{ code, message, details? }`. ID и количества в `details` строковые.

- `400 WAREHOUSE_STOCK_ID_INVALID`: неверный ID.
- `400 WAREHOUSE_STOCK_QUANTITY_INVALID`: неверное количество.
- `400 WAREHOUSE_STOCK_FILTER_INVALID`: неверные фильтры или пагинация.
- `400 WAREHOUSE_STOCK_SAME_LOCATION`: одинаковые места перемещения.
- `400 WAREHOUSE_STOCK_TRANSACTION_REQUIRED`: не передан транзакционный клиент.
- `400 WAREHOUSE_STOCK_ACTOR_REQUIRED`: не указан пользователь аудита.
- `404 WAREHOUSE_ITEM_NOT_FOUND`, `WAREHOUSE_LOCATION_NOT_FOUND`,
  `WAREHOUSE_BALANCE_NOT_FOUND`: отсутствует нужная запись.
- `409 WAREHOUSE_STOCK_INSUFFICIENT`: физически не хватает количества;
  `details` содержит `itemId`, `locationId`, `requested`, `available`.
- `409 WAREHOUSE_STOCK_QUANTITY_OVERFLOW`: превышен максимум отдельного остатка.

Ошибки инфраструктуры и конфликтов транзакций не маскируются под бизнес-ошибки.
