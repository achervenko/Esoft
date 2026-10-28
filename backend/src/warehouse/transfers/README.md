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
проверяются в транзакции, включая повтор проведённого запроса. Для переноса
резерва дополнительно требуется warehouse.reservations.manage. PATCH/DELETE нет.

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

Без флага (moveReservation=false по умолчанию) перемещается только свободное
количество MAX(physical - SUM(reservations), 0); резервы остаются на исходном месте.

Для переноса резерва передайте moveReservation=true и обязательный projectId:

```json
{
  "requestKey": "38822235-cf43-44fe-a761-c40afecb3f83",
  "itemId": "15",
  "fromLocationId": "8",
  "toLocationId": "9",
  "quantity": "3",
  "moveReservation": true,
  "projectId": "4"
}
```

В этом режиме всё quantity переносится из резерва выбранного активного проекта.
Смешанного переноса свободного и зарезервированного количества одной командой нет.
Резерв источника должен покрывать quantity; физически должно оставаться достаточно
для остальных проектов: quantity <= MAX(physical - reservedForOtherProjects, 0).
При существующем дефиците нельзя перемещением затронуть покрытие чужих резервов.
Целевой резерв того же проекта создаётся либо увеличивается; обнулённый исходный
резерв удаляется. Общий резерв проекта и физический итог по всем складам сохраняются.
Перенос между складами поддерживается. Принудительного расхода чужих резервов нет.
projectId без включённого флага и не-boolean значение флага отклоняются.

Порядок блокировок: пользователь → ключ запроса → проект (если указан) → склады в порядке ID →
Stock для обоих мест в стабильном порядке → резервы обоих остатков в стабильном порядке.
Все writers резервов используют тот же протокол Stock. Проверка доступного
количества, обе стороны Stock.moveStock, перенос выбранного резерва, запись операции и аудит выполняются
одной транзакцией ReadCommitted. Любая ошибка откатывает всё, включая новый balance.

Повтор с тем же ключом и нормализованными данными возвращает прежнюю операцию
без нового движения и аудита; другие данные дают 409 WAREHOUSE_TRANSFER_REQUEST_CONFLICT.
Replay выполняется до проверки текущих справочников, но после проверки текущих прав.

## История и ошибки

Ответ содержит id, itemId, fromLocationId, toLocationId, quantity, comment,
createdByUserId, createdAt, requestKey, moveReservation и snapshot. ID и количества — строки.
Snapshot хранит item (id/article/name/unit), from/to (общие DTO места со складом)
и fromQuantityBefore/After, toQuantityBefore/After. Переименования справочников
не меняют карточку, список или replay старого перемещения. Активность в снимке
также отражает момент проведения. snapshot.reservationTransfer хранит ID, номер
и название проекта, quantity и from/to: reservationId, balanceId, before/after.
В обычном режиме reservationTransfer=null. Перенос обоих резервов аудируется
отдельно со ссылкой на transferId. requestHash не публикуется.

- 400 WAREHOUSE_TRANSFER_INVALID — payload/query; формат ID/количества может
  возвращать соответствующие WAREHOUSE_STOCK_ID_INVALID/QUANTITY_INVALID.
- 403 FORBIDDEN — недостаточно прав или пользователь заблокирован.
- 404 WAREHOUSE_TRANSFER_NOT_FOUND — карточка не найдена.
- 404 WAREHOUSE_ITEM_NOT_FOUND / WAREHOUSE_LOCATION_NOT_FOUND / WAREHOUSE_BALANCE_NOT_FOUND.
- 409 WAREHOUSE_INACTIVE / WAREHOUSE_TRANSFER_INACTIVE_REFERENCE — неактивные справочники.
- 409 WAREHOUSE_TRANSFER_RESERVED_STOCK — количество больше доступного в выбранном режиме;
  details: physical, reserved, available, requested.
- 409 WAREHOUSE_TRANSFER_RESERVATION_INSUFFICIENT — исходного резерва проекта недостаточно.
- 409 WAREHOUSE_TRANSFER_PROJECT_UNAVAILABLE — проект отсутствует или неактивен.
- 409 WAREHOUSE_TRANSFER_RESERVATION_OVERFLOW — переполнение целевого резерва.
- 409 WAREHOUSE_STOCK_QUANTITY_OVERFLOW — превышение ёмкости целевого остатка.

Флаг и проект входят в hash команды; изменение режима или проекта с тем же ключом
даёт конфликт. Hash обычного режима сохранён совместимым с прежним контрактом.
Товар в пути и возвраты — отдельные будущие операции.
Таблица warehouse_transfers включена в init-миграцию ещё не выпущенного пакета.
