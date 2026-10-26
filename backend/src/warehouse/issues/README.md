# Issues

Backend фактической выдачи складской номенклатуры. Ручная выдача MANUAL и выдача
ISSUE_SHEET используют один механизм. Одна операция относится к одной номенклатуре,
но может расходовать несколько WarehouseBalance. Физический остаток меняется
только через Stock, резервы — через WarehouseReservationsService.
UI и управление созданием резервов не входят в этот компонент. Существующей схемы
warehouse достаточно, новых миграций нет.

## Доступ

Все операции требуют сессию и `warehouse.issues.manage` (admin/storekeeper).
Принудительная выдача дополнительно требует `warehouse.reservations.override`
(`WAREHOUSE_PERMISSIONS.OVERRIDE_RESERVATION`, на первом этапе только admin).
Право не привязано к проверке имени роли в Issues: его можно выдать другой роли
через общую permission-policy. Сервис повторно проверяет актуальные права и banned
под user FOR SHARE в транзакции. Подключение опциональное, через WarehouseModule.

## API

Префикс `/api/warehouse/issues`:

- GET `/available-balances?itemId=...&projectId=...&includeUnavailable=false`.
- POST `/`: createIssue.
- POST `/override-preview`: расчёт административного исключения, без изменений БД.
- GET `/`: getIssues.
- GET `/:id`: getIssue с позициями, проектом, пользователем, общим количеством
  и использованием резервов.

Сервис также предоставляет createManualIssue и createIssueFromSheet; это обёртки
того же механизма с проверкой типа. Создание принимает:

```json
{
  "type": "MANUAL",
  "projectId": "1",
  "positions": [{ "balanceId": "15", "quantity": "2.125" }],
  "comment": "Выдача для ремонта",
  "overrideReservations": false
}
```

Для ISSUE_SHEET обязателен issueSheetLineId; для MANUAL он отсутствует или null.
По листу проект берётся из строки, явно переданный projectId обязан совпадать.
У ручной выдачи projectId необязателен. ID — положительные десятичные строки bigint,
quantity — десятичная строка с точностью до 3 знаков, не number.
Принимаются 1–100 позиций, повторение balanceId запрещено. Все остатки должны
существовать, относиться к одной действующей номенклатуре и действующим местам.
Указанный проект должен существовать и быть активным.
Автор/время серверные, неизвестные поля запрещены, comment до 4000 символов.
Проведённые выдачи через этот API не редактируются и не удаляются.

## Доступность и расход

Без проекта available=max(physical-SUM(reservations),0).
Под проект available=max(physical-SUM(other reservations),0).
Собственный резерв доступен проекту. GET остатков возвращает balanceId, itemId,
location, physical, reserved, reservedForCurrentProject, reservedForOtherProjects,
available. При includeUnavailable=false нулевые available скрываются.
Отрицательная доступность при существующем дефиците резервов показывается как 0.

Обычная выдача не затрагивает чужие резервы. Для своего проекта сначала расходуется
собственный резерв, затем свободное количество. Исчерпанный резерв удаляется.
Снимок GET носит информационный характер: доступность повторно рассчитывается
после блокировок в транзакции создания.

## Подтверждение override

Для overrideReservations=true обязательны специальное право и непустой comment.
Сначала клиент отправляет такое тело в POST override-preview. Backend возвращает:

- confirmationToken — SHA-256 нормализованных параметров операции, пользователя,
  проекта, актуального физического количества, всех резервов выбранных остатков
  и рассчитанного плана расхода;
- foreignReservations — реально затрагиваемые чужие резервы с projectId,
  projectNumber, projectName, balanceId, quantity, before/after;
- reservationChanges — полный план собственного/чужого расхода;
- totalQuantity — суммарная выдача.

После показа предупреждения и явного подтверждения клиент повторяет запрос в POST
`/` с overrideConfirmation=confirmationToken. Создание заново блокирует данные,
пересчитывает план и сверяет hash. При любом отличии возвращается
WAREHOUSE_ISSUE_CONFIRMATION_REQUIRED; нужен новый preview и подтверждение.
Это контроль согласованности и подтверждение со стороны клиента, а не bearer-token
доступа: права отдельно проверяются на обоих шагах. Preview ничего не списывает
и не создаёт выдач/аудита. Подтверждение требуется даже если чужие резервы в итоге
не затронуты, но клиент запросил override.

Порядок расхода: собственный резерв -> свободное количество -> чужие резервы.
Без проекта: свободное -> чужие. Среди чужих резервов порядок детерминированный,
по ID резерва ASC; снимается только фактически использованное количество.
Физический остаток превышать нельзя даже с override.

## Транзакции и связь с IssueSheets

ReadCommitted, timeout 15 секунд. Порядок: пользователь -> лист (если есть) ->
проект -> все stock locks по отсортированным местам -> резервы.
Stock сам берёт item/location FOR SHARE и balance/advisory locks.
Все места блокируются до чтения актуальных резервов и проверки доступности.
Затем планируются все позиции; только после успешной проверки меняются резервы,
Stock, документы и аудит. Ошибка откатывает всё.

Для ISSUE_SHEET используется executeIssueForLine: лист блокируется, проверяются
состояние, номенклатура, проект и remaining с учётом предыдущих выдач. Первая
выдача переводит READY в IN_PROGRESS. Частичная выдача разрешена. После закрытия
листа новые выдачи запрещены. Preview использует previewIssueForLine с той же
проверкой и блокировкой, но без создания документов и смены статуса.

WarehouseReservationsService — внутренний контракт расходования существующих
резервов. Будущий модуль создания/редактирования резервов обязан брать те же
Stock.lockBalances до изменения резервов, включая создание отсутствующей записи.
Напрямую писать резервы параллельно в обход этих блокировок нельзя.

## Получение выдач

GET списка принимает все фильтры ТЗ: types, itemId/itemIds, projectId/projectIds,
balanceId, locationId, issueSheetId, issueSheetLineId, issuedByUserId,
overrideReservations, createdFrom/createdTo, minQuantity/maxQuantity,
sortBy, sortOrder, page, limit. Одиночный ID и соответствующий список вместе
запрещены. Списки передаются через запятую либо повторёнными query-параметрами.

Фильтры item/location/balance/minQuantity/maxQuantity применяются к одной
подходящей позиции выдачи (EXISTS), не к сумме документа. quantity-сортировка —
по общему количеству всех позиций документа, createdAt DESC по умолчанию,
ID разрешает ничьи. page=1, limit=50, максимум 100. Ответ items/total/page/limit.
Даты ISO, включительные границы; дата без времени означает полночь UTC.
Список, позиции и total читаются в одном RepeatableRead-снимке.

Карточка возвращает metadata, project, issuedBy, positions, totalQuantity,
reservationUsage и foreignReservationsUsed. Признак overrideReservations означает
запрошенный административный режим, foreignReservationsUsed — фактический расход
чужих резервов. План сохраняется в общем аудите WAREHOUSE,
entityType=warehouse_issue, поле «Использование резервов», включая ID, проект,
количество и before/after. Его необходимо сохранять при настройке retention аудита.
Для старых операций без такого снимка reservationUsage/foreignReservationsUsed=null,
чтобы отсутствие сведений не выдавалось за отсутствие расхода чужих резервов.
Расход отдельных резервов также аудируется отдельно.

## Проверки

```powershell
npm run build:backend
npm run test --workspace backend -- --runInBand warehouse/issues warehouse/reservations
$env:ESOFT_MODULAR_MIGRATION_TEST = '1'
try {
  node --test tests/scripts/infrastructure/prisma/warehouse-issues.real.integration.test.mjs
} finally {
  Remove-Item Env:ESOFT_MODULAR_MIGRATION_TEST
}
```

Интеграция использует временный PostgreSQL с core+warehouse, без рабочей БД.
Проверяются свободная/проектная выдача, несколько мест, расход резервов,
подтверждение и его устаревание, листы, гонки, фильтры и rollback аудита.
