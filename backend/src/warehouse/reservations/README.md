# Резервы проектов

Один `WarehouseProjectReservation` связывает конкретный `WarehouseBalance`
(номенклатура + место) с `projectId` и положительным количеством.
Используется существующая схема БД без миграций.

## API

Префикс `/api/warehouse/reservations`. Все маршруты требуют сессию и
`warehouse.reservations.manage` (admin/storekeeper). При выключенном warehouse
контроллер не подключается. `warehouse.reservations.override` остаётся отдельным
правом только admin и используется Issues, а не обычным управлением резервами.

- `GET /` — список `{items,total,page,limit}`. Фильтры `balanceId`, `projectId`,
  `itemId`, `locationId` объединяются через AND. `page=1`, `limit=50`, максимум 100.
  Стабильная сортировка id ASC, список и total читаются одним RepeatableRead-снимком.
- `POST /` — `{balanceId,projectId,quantity}`. Создаёт резерв, возвращает DTO.
  Существующая пара balance/project даёт 409 `WAREHOUSE_RESERVATION_EXISTS`.
- `PATCH /:id` — только `{quantity}`. Переназначение balance/project запрещено.
- `DELETE /:id` — снимает текущий резерв, возвращает `{released:true,id}`.
  Повторное снятие отсутствующего резерва даёт 404 `WAREHOUSE_RESERVATION_NOT_FOUND`.

DTO содержит `id`, `balanceId`, `projectId`, `quantity`, `item`
(id/article/name/unit/isActive), `location` (id/code/name/isActive), `project`
(id/projectNumber/name/isActive). ID — канонические bigint decimal strings,
количества — decimal strings до трёх знаков, максимум `99999999999.999`.
Ноль запрещён: для полного освобождения используется DELETE.
Неизвестные поля и некорректные значения отклоняются с 400.

## Проверки и конкурентность

Создание и увеличение требуют активных проекта, номенклатуры и места.
Количество не может превышать `max(physical - SUM(other reservations), 0)`;
при создании остальные резервы — все существующие. Нарушение даёт 409
`WAREHOUSE_RESERVATION_INSUFFICIENT` с physical/maximum/requested в details.
Неактивные или отсутствующий проект — 409 `WAREHOUSE_RESERVATION_UNAVAILABLE`;
отсутствующий balance — 404 `WAREHOUSE_BALANCE_NOT_FOUND`.

Снижение количества и снятие допускаются при дефиците и неактивных связанных
объектах, чтобы можно было освободить ранее созданный резерв.
PATCH тем же количеством успешен и не создаёт аудит.

Мутации выполняются в одной ReadCommitted-транзакции:

1. Пользователь под FOR SHARE: существование, banned и актуальное permission.
2. Проект под FOR SHARE — тот же порядок, что в Issues.
3. Чтение неизменяемых ключей balance, затем Stock.lockBalances.
4. Существующий WarehouseReservationsService.getLocked: резервы FOR UPDATE.
5. Повторное чтение состояния, проверка количества, запись резерва и аудита.

Первое чтение резерва для PATCH/DELETE не блокирует его: блокировки резервов
берутся только после Stock. Если Issues успел полностью израсходовать резерв,
повторная проверка возвращает 404. Параллельные POST/PATCH и выдачи сериализуются
на том же balance, включая защиту создания нового резерва.

ReservationsApiService — HTTP-сценарии, список и оркестрация транзакции;
существующий WarehouseReservationsService остаётся общим механизмом блокировки
и расходования резервов для API и Issues. Отдельного протокола блокировок нет.

Изменения пишутся через AuditLogService в WAREHOUSE,
entityType `warehouse_project_reservation`, entityStringId — ID резерва.
Снимки до/после содержат balanceId/projectId/quantity; снятие — DELETE.
Ошибка аудита откатывает всю мутацию. Физический остаток API не меняет.

warehouse_projects используется как текущий справочник-заглушка. CRUD проектов,
импорт 1С, сроки и статусы резервов, история отдельной таблицей и автоматическое
распределение по местам не входят в этот API.

## Проверка

HTTP permissions и validation проверяются `reservations*.spec.ts`.
Реальный PostgreSQL/PrismaPg-прогон:

```powershell
npm run build:backend
$env:ESOFT_MODULAR_MIGRATION_TEST = '1'
node --test tests/scripts/infrastructure/prisma/warehouse-reservations.real.integration.test.mjs
```

Тест использует изолированную временную БД и не подключается к рабочей.
