# Перемещения

Компонент Transfers оформляет немедленное перемещение одной номенклатуры между
двумя местами: внутри склада или между складами. Этапа «в пути» и подтверждения
принимающей стороны пока нет. Разные товары проводятся отдельными операциями.

## API

- POST /api/warehouse/transfers — проведение, HTTP 201 и при первом запросе, и при повторе.
- GET /api/warehouse/transfers — список: warehouseId, itemId, fromLocationId,
  toLocationId, page (1), limit (50, максимум 100). Ответ {items,total,page,limit}.
  warehouseId выбирает операции, где склад является исходным или целевым.
  Остальные фильтры объединяются через AND. Сортировка createdAt DESC, id DESC.
- GET /api/warehouse/transfers/:id — карточка.

Чтение требует warehouse.transfers.read, проведение — warehouse.transfers.manage.
Оба permission выданы admin/storekeeper. Текущие права и блокировка пользователя
проверяются в транзакции, включая повтор проведённого запроса. PATCH/DELETE нет.

Пример JSON:

```json
{
  "requestKey": "e650f09a-d037-43ba-9195-437241b14e0e",
  "itemId": "15",
  "fromLocationId": "8",
  "toLocationId": "9",
  "quantity": "3.125",
  "comment": "Переложили на соседнюю полку"
}
```

ID — канонические положительные bigint-строки, количество — положительная
десятичная строка с точностью до трёх знаков. requestKey — UUID, уникальный в
пределах пользователя; комментарий необязателен, trim/null, до 4000 символов.
Неизвестные поля отклоняются. Исходное и целевое места должны различаться.

## Правила и атомарность

Оба склада, места и номенклатура должны быть активными. Исходный остаток должен
существовать; целевой создаётся при необходимости. Нулевая исходная запись
сохраняется. Общая сумма по всем складам не меняется.

Перемещается только свободное количество MAX(physical - SUM(reservations), 0).
Резервы остаются на исходном balance, не уменьшаются и не создаются на целевом.
При дефиците перемещение невозможно. Принудительного режима нет.

Порядок блокировок: пользователь → ключ запроса → склады в порядке ID →
Stock для обоих мест в стабильном порядке → резервы исходного остатка.
Все writers резервов используют тот же протокол Stock. Проверка свободного
количества, обе стороны Stock.moveStock, запись операции и аудит выполняются
одной транзакцией ReadCommitted. Любая ошибка откатывает всё, включая новый balance.

Повтор с тем же ключом и нормализованными данными возвращает прежнюю операцию
без нового движения и аудита; другие данные дают 409 WAREHOUSE_TRANSFER_REQUEST_CONFLICT.
Replay выполняется до проверки текущих справочников, но после проверки текущих прав.

## История и ошибки

Ответ содержит id, itemId, fromLocationId, toLocationId, quantity, comment,
createdByUserId, createdAt, requestKey и snapshot. ID и количества — строки.
Snapshot хранит item (id/article/name/unit), from/to (общие DTO места со складом)
и fromQuantityBefore/After, toQuantityBefore/After. Переименования справочников
не меняют карточку, список или replay старого перемещения. Активность в снимке
также отражает момент проведения. requestHash не публикуется.

- 400 WAREHOUSE_TRANSFER_INVALID — payload/query; формат ID/количества может
  возвращать соответствующие WAREHOUSE_STOCK_ID_INVALID/QUANTITY_INVALID.
- 403 FORBIDDEN — недостаточно прав или пользователь заблокирован.
- 404 WAREHOUSE_TRANSFER_NOT_FOUND — карточка не найдена.
- 404 WAREHOUSE_ITEM_NOT_FOUND / WAREHOUSE_LOCATION_NOT_FOUND / WAREHOUSE_BALANCE_NOT_FOUND.
- 409 WAREHOUSE_INACTIVE / WAREHOUSE_TRANSFER_INACTIVE_REFERENCE — неактивные справочники.
- 409 WAREHOUSE_TRANSFER_RESERVED_STOCK — количество больше свободного;
  details: physical, reserved, available, requested.
- 409 WAREHOUSE_STOCK_QUANTITY_OVERFLOW — превышение ёмкости целевого остатка.

Перенос резервов, товар в пути и возвраты — отдельные будущие операции.
Таблица warehouse_transfers включена в init-миграцию ещё не выпущенного пакета.
