# Auth

Модуль обеспечивает вход пользователей, сессии Better Auth, машинную аутентификацию и серверную проверку разрешений. Назначение ролей и авторизация учитывают подключённые функциональные модули.

## Архитектура

`AppAuthModule` подключает Better Auth через `forRootAsync()`. Фабрика `createAuth(prisma, activeModules)` получает Prisma и состав модулей из Nest DI. Сервисы обращаются к общему экземпляру через `AuthService<Auth>`.

`PrismaModule` предоставляет один `PrismaService` на контейнер Nest. Соединение открывается в `onModuleInit` и освобождается в `onApplicationShutdown` после завершения активных HTTP-запросов. Первоначальная настройка администратора использует тот же Auth и Prisma.

Архитектурный контракт `auth.config.ts`: импорт предоставляет фабрику и тип `Auth`; создание экземпляра и чтение конфигурации выполняются при вызове фабрики. Конфигурация Auth загружается через `root-environment`.

| Компонент                                      | Ответственность                                                  |
| ---------------------------------------------- | ---------------------------------------------------------------- |
| `auth.config.ts`, `auth.module.ts`             | Создание Better Auth, плагины, trusted origins и HTTP-интеграция |
| `effective-session.ts`                         | Представление эффективных ролей и permissions в сессии           |
| `role-module-policy.ts`                        | Проверка назначений и доступности ролей                          |
| `role-aware-prisma-adapter.ts`                 | Атомарная проверка изменения ролей при записи через Better Auth  |
| `permission-policy.ts`, `permissions.guard.ts` | Бизнес-разрешения и защита NestJS endpoints                      |
| `better-auth-access.ts`                        | Разрешения административного плагина Better Auth                 |
| `machine-api-keys.service.ts`                  | Машинные ключи и их область действия                             |

## Аутентификация

Пользователи входят по логину и паролю. Самостоятельная регистрация отключена. После создания пользовательской сессии `AuthLoginService` обновляет `lastLoginAt`; ошибка обновления фиксируется в журнале Auth.

Login, get-session и другие маршруты Better Auth обслуживаются его middleware. NestJS получает результат аутентификации через `AUTHENTICATE_REQUEST`.

Машинные интеграции используют плагин `@better-auth/api-key` с конфигурацией `machine`. Ключ проверяется по явно запрошенным permissions и не создаёт пользовательскую HTTP-сессию. Источник обмена и системный автор дополнительно проверяются ядром интеграций.

## Авторизация

В NestJS зарегистрирован один глобальный `PermissionsGuard`. Он сначала выполняет аутентификацию Better Auth, затем проверяет разрешение конкретного обработчика. Автоматический глобальный `AuthGuard` библиотеки отключён верхнеуровневой опцией `disableGlobalAuthGuard` в `forRootAsync()`.

Бизнес-endpoints объявляют разрешения через `@RequirePermission(...)`. Все перечисленные разрешения обязательны (AND). Публичные обработчики явно помечены `@AllowAnonymous()` на методе. Неразмеченный endpoint закрыт, в том числе для администратора.

`permission-policy.ts` объединяет права активных ролей. Frontend использует полученный от сервера массив `permissions` для навигации и действий; backend независимо проверяет каждый запрос. Права Better Auth на административные операции и бизнес-permissions NestJS — отдельные контракты.

Подробности: [PERMISSIONS.md](PERMISSIONS.md).

## Модульность

Доступность ролей определяется составом пакетов из `database-packages.json`. Изменение состава вступает в силу после перезапуска backend.

Назначения пользователя сохраняются при отключении функционального модуля; эффективный доступ вычисляется по активным ролям. Изменение назначений проверяется транзакционно. Контракты `role`, `assignedRole` и `permissions`, правила нормализации и конкурентного обновления описаны в [ROLE-POLICY.md](ROLE-POLICY.md).

## Безопасность

- Управление учётными записями предоставляется только роли `admin`.
- Impersonation и физическое удаление пользователей запрещены всем ролям.
- Разрешение обработчика дополняется проверками владельца объекта и его состояния в соответствующем модуле.
- Машинные ключи ограничены permissions и областью источника; выдача и отзыв выполняются серверными сервисами.
- Первоначальная настройка проверяет состояние setup, Origin и частоту запросов; создание первого администратора защищено транзакционной блокировкой.
- При изменении ролей сохраняются проверки доступности назначения и последнего администратора.

Точные условия и ограничения приведены в [PERMISSIONS.md](PERMISSIONS.md) и [ROLE-POLICY.md](ROLE-POLICY.md).

## Конфигурация

| Переменная           | Назначение                                   |
| -------------------- | -------------------------------------------- |
| `BETTER_AUTH_SECRET` | Секрет Auth, обязателен во всех средах       |
| `BETTER_AUTH_URL`    | Внешний origin Auth, обязателен в production |
| `FRONTEND_URL`       | Origin frontend, обязателен в production     |

URL допускают `http:` или `https:` и содержат только origin: без path, query и hash. Trusted origins формируются из `FRONTEND_URL`. В development также добавляются localhost и 127.0.0.1 с протоколом и портом frontend. В production дополнительные локальные origins не добавляются.

Общий контракт конфигурации: [CONFIGURATION.md](../../../docs/CONFIGURATION.md).

## Тестирование и проверка безопасности

Команды из корня репозитория:

```powershell
npm run build
npm run lint
npm test
```

Целевые проверки бэкенда:

```powershell
npm run test --workspace backend -- --runInBand auth setup user-accounts-admin.service application-shutdown prisma.module
```

Unit-тесты покрывают жизненный цикл Auth и Prisma, наборы ролей, объединение разрешений, разметку endpoints, владение профилем, первоначальную настройку и запреты административных операций.

Реальные HTTP/SQL-проверки выполняются на изолированном PostgreSQL:

```powershell
npm run build:backend
$env:ESOFT_MODULAR_MIGRATION_TEST = '1'
try {
  node --test tests/scripts/infrastructure/prisma/role-availability.real.integration.test.mjs tests/scripts/infrastructure/prisma/optional-modules.real.integration.test.mjs
} finally {
  Remove-Item Env:ESOFT_MODULAR_MIGRATION_TEST
}
```

Интеграционные тесты проверяют изменение ролей через Better Auth и административный API, эффективные сессии, конкурирующие записи, доступ по модулям, первоначальную настройку и вход. Матрица составов модулей также проверяет единственный глобальный `PermissionsGuard` и отсутствие дополнительных глобальных guard’ов.

Подготовка тестового PostgreSQL: [DATABASE-PACKAGES.md](../../../docs/DATABASE-PACKAGES.md#проверка-пакетов).

## Связанные документы

- [ROLE-POLICY.md](ROLE-POLICY.md) — назначения ролей, модульная доступность и транзакционная защита.
- [PERMISSIONS.md](PERMISSIONS.md) — guards, разметка endpoints, машинные ключи и защита setup.
- [Интеграции](../../../docs/INTEGRATIONS.md) — источники, потоки и приём машинных событий.
