# Auth

Модуль отвечает за вход пользователей, сессии Better Auth и общие проверки ролей для backend.

## Основные файлы

- `auth.config.ts` — конфигурация Better Auth, Prisma adapter, env-проверки, trusted origins, login hook.
- `auth.module.ts` — подключение Better Auth к NestJS и parser для auth-запросов.
- `better-auth-access.ts` — access control Better Auth admin plugin.
- `role-permissions.ts` — бизнес-проверки ролей для NestJS-контроллеров и сервисов.
- `auth-login.service.ts` — обновление `lastLoginAt` после успешного создания пользовательской сессии.
- `better-auth-access.spec.ts` — unit-проверки конфигурации Better Auth access control.

## Роли

В проекте используются роли:

- `admin`
- `chief_engineer`
- `engineer`
- `operator`
- `auditor`
- `ppe_specialist` — Специалист по охране труда

`admin` — единственная роль, которая управляет учётными записями. Остальные роли не получают административных разрешений Better Auth.

`ppe_specialist` получает рабочие права только в рамках сценариев модуля СИЗ.
Доступ к сотрудникам и должностям предоставляется только через специализированные
PPE endpoints и только в объёме, необходимом для работы с СИЗ, включая изменение
размеров сотрудников. Универсальные users-admin endpoints ему недоступны.
Пять основных PPE-разрешений определены отдельно в `role-permissions.ts`;
`canBackdatePpeIssue` отдельно разрешает указание даты выдачи только `admin`.
Подробности
и маршруты перечислены в `../ppe/README.md`.

## Better Auth

Самостоятельная регистрация отключена:

```ts
emailAndPassword: {
  enabled: true,
  disableSignUp: true,
}
```

Административный plugin Better Auth остаётся включённым, но его права переопределены в `better-auth-access.ts`.

Администратор может:

- создавать пользователей;
- просматривать пользователей;
- менять роль;
- блокировать и разблокировать;
- устанавливать или менять пароль;
- менять email и данные пользователя;
- просматривать и завершать сессии.

Администратор не может:

- физически удалять пользователя;
- создавать сессию от имени другого пользователя через impersonation.

Права `impersonate`, `impersonate-admins` и `user.delete` не должны добавляться ни одной роли.

## Env

Обязательные переменные:

- `BETTER_AUTH_SECRET` — обязателен во всех средах.
- `BETTER_AUTH_URL` — обязателен в production.
- `FRONTEND_URL` — обязателен в production.

URL проходят строгую проверку:

- только `http:` или `https:`;
- только origin без path, query и hash.

В development разрешены:

- `http://127.0.0.1:5173`
- `http://localhost:5173`

В production localhost не добавляется в trusted origins.

## NestJS permissions

`role-permissions.ts` не является Better Auth access control. Это отдельный слой бизнес-авторизации для backend:

- разрешения описываются декларативно в `ROLE_PERMISSIONS`;
- `assertAdmin()` — управление учётными записями;
- `assertCanViewUserProfile()` — свой профиль или admin;
- `assertCanEditEquipment()` — редактирование оборудования;
- `assertCanManageFiles()` — работа с файлами;
- `assertCanManageEquipmentEvents()` — события оборудования;
- `assertCanManageEvents()` / `assertCanViewEvents()` — события;
- `assertCanAccessCalendar()` — административный доступ к календарю;
- `assertCanManageChecklists()` — чек-листы.

Не смешивать этот файл с `better-auth-access.ts`: Better Auth permissions и бизнес-права NestJS живут отдельно.

## Login hook

После создания обычной пользовательской сессии `AuthLoginService` обновляет `lastLoginAt`.

Impersonation запрещён на уровне Better Auth access control, поэтому login hook не содержит исключений для `impersonatedBy`.

## Правила изменений

При изменении auth-контура проверить:

```bash
npm run build
npm run lint
npm test
```

Минимальные targeted-проверки для этого модуля:

```bash
npx eslint src/auth/auth.config.ts src/auth/better-auth-access.ts src/auth/role-permissions.ts
npm test -- src/auth/better-auth-access.spec.ts src/auth/ppe-permissions.spec.ts
```

Перед расширением прав Better Auth отдельно проверить, что:

- impersonation остаётся запрещённым;
- физическое удаление пользователей остаётся запрещённым;
- `admin` остаётся единственной ролью управления аккаунтами.
