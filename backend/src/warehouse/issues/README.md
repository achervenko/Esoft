# Выдачи склада

Issues оформляет фактическое списание одной номенклатуры с одного или нескольких
мест одного склада. Поддерживаются ручная выдача и исполнение строки листа выдачи.
Изменение количества выполняется через WarehouseStockService.

## API и доступ

Все маршруты требуют `warehouse.issues.manage` (admin/storekeeper).

- `POST /api/warehouse/issues`: `requestKey` (UUID), `type` (`MANUAL` или
  `ISSUE_SHEET`), `issueSheetLineId` для выдачи по листу, `positions` и
  необязательный `comment` до 4000 символов.
- `GET /api/warehouse/issues/available-balances`: `itemId`, необязательные
  `warehouseId` и `includeUnavailable`. Возвращает `{items}` с `balanceId`,
  `itemId`, `location`, `quantity`; нулевые количества включаются при
  `includeUnavailable=true`.
- `GET /api/warehouse/issues`: `{items,total,page,limit}`.
- `GET /api/warehouse/issues/:id`: историческая карточка.

В каждой позиции POST обязательны `balanceId` и положительная decimal-строка
`quantity` (до трёх знаков после запятой). От 1 до 100 позиций; повторение
остатка запрещено. ID передаются положительными bigint-строками.
Неизвестные поля отклоняются. Тип выдачи должен соответствовать наличию строки листа.

Фильтры списка: `warehouseId`, `search`, `types`, `itemId`/`itemIds`, `balanceId`,
`locationId`, `issueSheetId`, `issueSheetLineId`, `issuedByUserId`, `createdFrom`,
`createdTo`, `minQuantity`, `maxQuantity`, `sortBy=createdAt|quantity`,
`sortOrder=asc|desc`, `page`, `limit`. Поиск буквальный по историческому тексту.
По умолчанию сортировка createdAt DESC, id DESC, page=1, limit=50 (максимум 100).
Список и total читаются в RepeatableRead.

## Проведение и повторные запросы

Права и banned проверяются под блокировкой пользователя. Порядок блокировок:
пользователь → advisory-блокировка requestKey → лист (если задан) → склад →
номенклатура/места → остатки. Все места блокируются через Stock до изменения
первой позиции. Операция выполняется в одной ReadCommitted-транзакции.
Все позиции относятся к одному товару и складу; товар, склад и места активны.
Stock разрешает выдачу только из свободного остатка. Ошибка любой позиции или
аудита откатывает выдачу и все списания.

Исполнение строки листа использует `executeIssueForLine` в той же транзакции.
Лист проверяет состояние, требуемый остаток задания и результат callback.

`WarehouseIssueRequest` хранит hash нормализованной команды и JSON ответа под
ключом `(actorUserId, requestKey)`. Повтор возвращает исходный ответ без нового
списания и аудита. Перестановка позиций и эквивалентная запись количества не
меняют hash. Иное содержимое с тем же ключом даёт
`409 WAREHOUSE_ISSUE_REQUEST_CONFLICT`. Текущие права проверяются и при повторе.

## История и аудит

Выдача хранит снимок склада, пользователя и листа; позиции — снимки товара,
единицы и места. Переименование справочников и очистка технических запросов
или аудита не меняют историческую карточку. `searchText` строится из снимков
и комментария. Выдача и физические остатки записываются в общий аудит в том же tx.

## Проверки

```powershell
npm run test --workspace backend -- --runInBand warehouse/issues
$env:ESOFT_MODULAR_MIGRATION_TEST = '1'
node --test tests/scripts/infrastructure/prisma/warehouse-issues.real.integration.test.mjs
```

Интеграционные проверки используют изолированный PostgreSQL: доступ, склады,
листы, конкурентные списания, replay, откат аудита и неизменяемость истории.
