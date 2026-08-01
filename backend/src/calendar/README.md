# Calendar Backend

Модуль `Calendar` отвечает за единое календарное представление системы и
производственный календарь.

## Принцип

В системе существует один календарь. Различия между пользователями задаются не
отдельными календарями, а набором доступных направлений, события которых
показываются в общем календаре.

Календарь не является владельцем событий:

- не создаёт события самостоятельно;
- не хранит события всех модулей;
- не изменяет данные событий напрямую;
- получает события от модулей-источников в запрошенном диапазоне дат.

Если календарный интерфейс инициирует изменение события, например перенос через
drag and drop, изменение должно пройти через сервис событий с проверкой прав и
бизнес-логики.

Ответственность модулей:

```text
Calendar
    ├── хранит календарные дни
    ├── хранит производственный календарь
    └── отображает события модулей-источников

Events
    └── владеет событиями

Planning
    └── создаёт будущие события

Checklists
    └── закрывают события через workflow работ
```

## Что реализовано

На текущем этапе реализована инфраструктура календаря:

- таблица `calendar_days`;
- таблица `calendar_workdays`;
- enum `calendar_source`;
- связь `calendar_days 1:1 calendar_workdays`;
- индексы и ограничения БД;
- контракт первичного заполнения календарных дней и производственного календаря;
- инфраструктурная генерация календаря на диапазон `CALENDAR_START_DATE` -
  `CALENDAR_END_DATE`;
- seed-инициализация календаря;
- `CalendarRepository`;
- `CalendarService`;
- `Calendar Engine`;
- `ProductionCalendarProvider`;
- `EquipmentEventsProvider`;
- read-only endpoint готового календарного представления;
- минимальный REST API;
- проверка целостности календаря.

Импорт производственного календаря, планирование, уведомления, drag and drop и
frontend в текущий слайс не входят.

## Модель данных

```text
calendar_days
      │
      │ 1:1
      ▼
calendar_workdays
```

### calendar_days

`calendar_days` хранит календарные характеристики даты в диапазоне
`CALENDAR_START_DATE` - `CALENDAR_END_DATE`.

Поля:

- `id` — технический первичный ключ;
- `date` — календарная дата, уникальна;
- `year` — календарный год;
- `quarter` — квартал;
- `month` — месяц;
- `week` — ISO-неделя;
- `iso_week_year` — ISO-год недели;
- `day` — день месяца;
- `day_of_week` — ISO-день недели, понедельник `1`, воскресенье `7`;
- `day_of_year` — день года;
- `created_at`, `updated_at` — технические timestamps.

Все денормализованные календарные поля проверяются на соответствие `date` на
уровне PostgreSQL через `EXTRACT(...)`. Это исключает противоречивые записи
вида `date = '2026-02-15'` и `month = 12`.

Индексы:

- `PK(id)`;
- `UNIQUE(date)`;
- `INDEX(year)`;
- `INDEX(year, month)`;
- `INDEX(iso_week_year, week)`.

Индекс по неделям строится именно по `iso_week_year, week`, потому что ISO-неделя
на границе года может относиться к соседнему ISO-году.

### calendar_workdays

`calendar_workdays` хранит производственный календарь для каждой записи
`calendar_days`.

Поля:

- `calendar_day_id` — первичный ключ и FK на `calendar_days.id`;
- `is_working_day` — нормативно рабочий день;
- `is_holiday` — праздничный день;
- `is_preholiday` — предпраздничный день;
- `holiday_name` — название праздника;
- `working_hours` — нормативное количество рабочих часов по производственному календарю;
- `source` — происхождение записи;
- `created_at`, `updated_at` — технические timestamps.

`working_hours` описывает норму производственного календаря, а не фактически
отработанное время. Поэтому:

- для рабочего дня `working_hours > 0`;
- для нерабочего дня `working_hours = 0`;
- сверхурочная работа в выходной день должна отражаться в событиях, а не в
  производственном календаре.

Индексы:

- `PK/FK(calendar_day_id)`;
- `INDEX(is_working_day)`;
- `INDEX(is_holiday)`.

Отдельный индекс по `is_preholiday` не создаётся: самостоятельных массовых
выборок только по этому признаку на первом этапе не предполагается.

## calendar_source

`calendar_source` фиксирует происхождение записи производственного календаря:

```text
SYSTEM
IMPORT
MANUAL
```

- `SYSTEM` — первичное заполнение при установке системы;
- `IMPORT` — запись получена из внешнего источника;
- `MANUAL` — запись изменена администратором вручную.

## Первичное заполнение

При установке системы должны быть созданы все даты от `CALENDAR_START_DATE` до
`CALENDAR_END_DATE`.

Для каждой даты создаётся одна запись `calendar_days` и одна связанная запись
`calendar_workdays`.

Календарные поля должны рассчитываться средствами языка, библиотеки работы с
датами или PostgreSQL. Ручной расчёт високосных лет, количества дней в месяце и
переходов между месяцами или годами не допускается.

Значения генератора должны совпадать с PostgreSQL:

- `year = EXTRACT(YEAR FROM date)`;
- `quarter = EXTRACT(QUARTER FROM date)`;
- `month = EXTRACT(MONTH FROM date)`;
- `week = EXTRACT(WEEK FROM date)`;
- `iso_week_year = EXTRACT(ISOYEAR FROM date)`;
- `day = EXTRACT(DAY FROM date)`;
- `day_of_week = EXTRACT(ISODOW FROM date)`;
- `day_of_year = EXTRACT(DOY FROM date)`.

Заполнение `calendar_workdays` по умолчанию:

- понедельник-пятница: `is_working_day = true`, `working_hours = 8.00`;
- суббота-воскресенье: `is_working_day = false`, `working_hours = 0.00`;
- `is_holiday = false`;
- `is_preholiday = false`;
- `holiday_name = null`;
- `source = SYSTEM`.

Генерация идемпотентна: повторный seed дозаполняет отсутствующие строки, но не
перезаписывает уже существующие записи производственного календаря.

## Backend-компоненты

- `calendar.generator.ts` — генерация полного диапазона календаря и базового
  производственного календаря.
- `CalendarRepository` — слой доступа к данным без бизнес-логики.
- `CalendarService` — фасад операций чтения календаря, изменения
  производственного дня и проверки целостности.
- `CalendarWorkdayWriterService` — изменение производственного дня, применение
  бизнес-правил, выполнение обновления в транзакции и запись аудита через общий
  `AuditLogService`.
- `CalendarEngineService` — read-only ядро формирования готовой календарной
  модели из набора провайдеров.
- `CalendarSourceResolver` — выбирает доступные календарные источники для
  текущего пользователя.
- `ProductionCalendarProvider` — поставщик дней производственного календаря для
  Engine.
- `EquipmentEventsProvider` — поставщик событий оборудования для Engine.
- `CalendarController` — минимальный REST API.

## API

```text
GET   /api/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
GET   /api/calendar/day?date=YYYY-MM-DD
GET   /api/calendar/range?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD
PATCH /api/calendar/workday
```

`GET /api/calendar` — read-only endpoint `Calendar Engine`. Он возвращает
готовую календарную модель для фронтенда. Доступ получают пользователи, у
которых есть право просмотра хотя бы одного календарного источника. На первом
этапе это роли с правом просмотра событий.

Административные endpoints производственного календаря
`/api/calendar/day`, `/api/calendar/range`, `/api/calendar/workday` доступны
только администраторам.

`GET /api/calendar/day` возвращает один день календаря.

`GET /api/calendar/range` возвращает диапазон дат. На текущем этапе диапазон
ограничен `370` днями за запрос.

`PATCH /api/calendar/workday` изменяет производственный календарь для одной
даты. Источник изменения всегда становится `MANUAL`.

Пример body:

```json
{
  "date": "2026-12-31",
  "isWorkingDay": false,
  "isHoliday": true,
  "isPreholiday": false,
  "holidayName": "Новый год",
  "workingHours": 0
}
```

Если день переводится в нерабочий без явного `workingHours`, сервис выставляет
`0`. Если день переводится в рабочий с текущих `0` часов без явного
`workingHours`, сервис использует значение константы `DEFAULT_WORKING_HOURS`.

## Calendar Engine

`Calendar Engine` формирует read-only календарное представление для клиентов.
Он не хранит собственные данные и не является источником правды. Данные
остаются во владении модулей-источников:

- производственный календарь владеет календарными днями;
- `Events` владеет событиями;
- будущий модуль планирования будет владеть правилами планирования.

Engine отвечает только за:

- получение периода;
- вызов доступных `CalendarProvider`;
- объединение результатов;
- проверку уникальности слоёв;
- возврат готового DTO.

Engine не должен:

- знать роли пользователей;
- проверять права;
- знать конкретные модули через условия вида `if (equipment)`;
- создавать или изменять события;
- изменять производственный календарь;
- хранить состояние календаря.

Все решения о том, какие источники доступны пользователю, принимает
`CalendarSourceResolver`.

### Поток запроса

```text
GET /api/calendar
      │
      ▼
CalendarController
      │
      ├── CalendarSourceResolver
      │       └── выбирает Provider'ы
      │
      ▼
CalendarEngineService
      │
      ├── ProductionCalendarProvider
      └── EquipmentEventsProvider
```

`CalendarController` сначала получает список provider'ов через resolver, затем
валидирует период и передаёт всё в Engine.

### Период

Endpoint принимает:

```http
GET /api/calendar?from=2027-01-01&to=2027-01-31
```

Правила:

- `from` и `to` обязательны;
- формат дат — `YYYY-MM-DD`;
- `from <= to`;
- даты должны лежать в диапазоне `CALENDAR_START_DATE` - `CALENDAR_END_DATE`;
- длина периода не должна превышать `CALENDAR_RANGE_LIMIT_DAYS`.

### DTO

```ts
type CalendarDto = {
  days: CalendarDayDto[];
  layers: CalendarLayerDto[];
};
```

`days` содержит готовые дни производственного календаря:

```ts
enum CalendarDayType {
  HOLIDAY = 'HOLIDAY',
  SHORTENED = 'SHORTENED',
  WEEKEND = 'WEEKEND',
  WORKING = 'WORKING',
}

type CalendarDayDto = {
  comment: string | null;
  date: string;
  isManual: boolean;
  type: CalendarDayType;
};
```

`layers` содержит календарные слои. Слой отвечает за то, что отображается, а
источник item — за то, из какого модуля пришёл элемент.

```ts
type CalendarLayerCode = string;

type CalendarItemSource = string;

type CalendarNavigationDto = {
  params?: Record<string, boolean | number | string | null>;
  type: string;
};

type CalendarLayerDto = {
  code: CalendarLayerCode;
  items: CalendarLayerItemDto[];
  title: string;
};

type CalendarLayerItemDto = {
  badge?: string | null;
  description?: string | null;
  details?: unknown;
  displayDate: string;
  factDate?: string | null;
  icon?: string | null;
  id: string;
  isOverdue?: boolean;
  navigation?: CalendarNavigationDto | null;
  overdueDays?: number;
  plannedDate?: string | null;
  source: CalendarItemSource;
  status?: string;
  subtitle?: string | null;
  title: string;
};
```

`CalendarLayerDto.code` должен быть уникален в пределах одного `CalendarDto`.
Если два provider'а вернут слой с одинаковым `code`, Engine вернёт ошибку
`CALENDAR_LAYER_DUPLICATE`.

### CalendarProvider

Каждый источник реализует единый контракт:

```ts
interface CalendarProvider {
  getCalendarData(period: CalendarPeriod): Promise<CalendarProviderResult>;
}
```

Provider получает уже проверенный период и должен сразу запрашивать только
нужные данные. Запрещается загружать весь год или все события, а затем
фильтровать их в памяти.

Provider может вернуть:

- только `days`;
- только `layers`;
- оба поля;
- пустой объект, если данных нет.

### ProductionCalendarProvider

`ProductionCalendarProvider` использует `CalendarService.getRange()` и
преобразует внутреннюю модель производственного календаря в UI-тип дня.

Правила маппинга:

- `isHoliday = true` -> `HOLIDAY`;
- `isPreholiday = true` -> `SHORTENED`;
- `isWorkingDay = true` -> `WORKING`;
- иначе `WEEKEND`.

`isManual = source !== SYSTEM`.

`comment = holidayName`.

### EquipmentEventsProvider

`EquipmentEventsProvider` использует read-only слой `EventsQueryService`.

Provider возвращает один слой:

```text
code = EVENTS
title = События
```

Каждый элемент события оборудования получает:

```text
source = EQUIPMENT
```

Событие отображается по `displayDate`:

```text
displayDate = factDate ?? plannedDate
```

Фильтрация по периоду выполняется на уровне запроса именно по этому правилу:

- события с `factDate` выбираются по `factDate`;
- события без `factDate` выбираются по `plannedDate`.

Provider обязательно передаёт в DTO обе даты:

- `plannedDate`;
- `factDate`.

Если обе даты отсутствуют, provider возвращает ошибку
`CALENDAR_EVENT_DATE_MISSING`.

### Просрочка

Просрочку рассчитывает backend, а не frontend.

Правила:

- если `factDate != null`, событие считается выполненным и `isOverdue = false`;
- если `factDate == null` и `plannedDate < today`, `isOverdue = true`;
- если `plannedDate >= today`, `isOverdue = false`;
- `overdueDays` считается календарными днями от `plannedDate` до текущей даты.

Frontend должен только отображать готовые признаки `isOverdue` и `overdueDays`.

### Расширение Engine

Новые источники подключаются добавлением нового `CalendarProvider` и обновлением
`CalendarSourceResolver`.

`CalendarEngineService` при этом изменяться не должен. Он работает только с
интерфейсом provider'а и не содержит знаний о конкретных модулях.

## Целостность

`CalendarService` умеет проверять календарь на повреждения:

- количество записей `calendar_days`;
- количество записей `calendar_workdays`;
- отсутствие дыр в диапазоне `CALENDAR_START_DATE` - `CALENDAR_END_DATE`;
- отсутствие дублей дат;
- наличие производственного календаря для каждого календарного дня;
- отсутствие записей `calendar_workdays`, которые не связаны с
  `calendar_days`.

Если календарь повреждён, сервис возвращает ошибку `CALENDAR_DAMAGED`.

## Представления календаря

На первом этапе календарь должен поддерживать следующие режимы отображения:

- день;
- неделя;
- месяц;
- квартал;
- год.

Добавление новых представлений не должно требовать изменения модели данных
календаря.

## Работа со временем

На первом этапе календарь работает только с датами:

- время начала и окончания события не используется;
- все события считаются однодневными;
- поддержка времени появится позже вместе с модулем планирования рабочего
  времени.

## Аудит

Отдельная история изменений календаря не создаётся. Изменения
производственного календаря должны фиксироваться общим механизмом `Audit Log`,
который используется всеми модулями системы.

`PATCH /api/calendar/workday` пишет аудит только после успешного изменения в той
же транзакции, что и обновление производственного дня. Записи создаются по
фактически изменившимся полям и содержат:

- `user_id` пользователя, выполнившего изменение;
- `module = CALENDAR`;
- `action = UPDATE`;
- `entity_type = calendar_workday`;
- `entity_string_id = YYYY-MM-DD` изменяемой календарной даты;
- `old_value` и `new_value` для каждого изменённого поля.

## Импорт производственного календаря

Импорт файлов на текущем этапе не реализован.

Инфраструктурная точка расширения для будущего импорта —
`CalendarWorkdayWriterService`. Будущий импорт из Excel или другого источника
должен нормализовать внешние данные в `CalendarWorkdayUpdate` и передавать их в
writer-сервис. Так импорт сможет переиспользовать те же бизнес-правила,
транзакционное обновление и Audit Log, не меняя публичный `CalendarService`,
REST API и модель данных календаря.
