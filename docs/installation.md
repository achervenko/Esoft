# Установка проекта

Разделение SQL на ядро, оборудование и СИЗ, состав новой установки и позднее подключение: [DATABASE-PACKAGES.md](DATABASE-PACKAGES.md).

Это руководство описывает подготовку среды и первый запуск Esoft с нуля.
Все команды выполняйте из PowerShell.

## 1. Необходимые программы

Для развёртывания программы необходимо, чтобы на компьютере были установлены следующие программы:

- Git;
- Node.js 24.x;
- npm;
- PostgreSQL 17;
- pgAdmin 4;
- MinIO Server.

## 2. Установка недостающих программ

Если PostgreSQL или MinIO ещё не установлены, установите их по инструкциям ниже.

### PostgreSQL

Скачайте и установите PostgreSQL 17 с официального сайта:

<https://www.postgresql.org/download/windows/>

1. Во время установки:
   - оставьте выбранным компонент **pgAdmin 4**;
   - запомните пароль пользователя `postgres`;
   - остальные параметры можно оставить по умолчанию.

2. После завершения установки откройте **pgAdmin 4** и подключитесь к локальному серверу PostgreSQL, используя пароль пользователя `postgres`.

3. Создайте нового пользователя со следующими параметрами:
   - имя пользователя — `esoft`;
   - пароль — задайте самостоятельно;
   - права:
     - **Can login?** — `Yes`;
     - **Superuser?** — `No`;
     - **Create roles?** — `No`;
     - **Create databases?** — `No`;
     - **Replication?** — `No`;
     - **Bypass RLS?** — `No`.

4. Создайте новую базу данных:
   - имя базы данных — `esoft`;
   - владелец — созданный пользователь `esoft`.

При заполнении файла `.env` рекомендуется использовать адрес сервера `127.0.0.1` вместо `localhost`.

### Разделение прав PostgreSQL в production

Для локальной разработки пользователь `esoft` может быть владельцем своей базы без прав superuser. В production используйте две отдельные роли:

- `esoft_migrator` — владелец базы и объектов, используется оператором для setup, миграций и восстановления;
- `esoft` — пользователь backend, имеет только доступ к данным приложения. Он не должен быть владельцем базы, наследовать роль миграций или иметь права superuser.

Для новой production-базы вместо шагов 3–4 выполните следующий SQL в pgAdmin под администратором PostgreSQL, подключившись к базе `postgres`. Замените оба пароля на разные случайные значения. Команды создания базы выполняйте вне транзакции.

```sql
CREATE ROLE esoft_migrator LOGIN PASSWORD 'replace_migrator_password'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE esoft LOGIN PASSWORD 'replace_application_password'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE DATABASE esoft OWNER esoft_migrator
  TEMPLATE template0 ENCODING 'UTF8'
  LOCALE_PROVIDER icu ICU_LOCALE 'ru-RU' LOCALE 'C';
```

Затем подключитесь к базе `esoft` под администратором PostgreSQL и выполните:

Указанная локаль ICU нужна для корректной работы кириллицы в `lower()`, поиске и уникальности названий без учёта регистра. Установщик до SQL проверяет UTF8 и результат `lower('ЁЖИК АБВ') = 'ёжик абв'`. Одна лишь локаль libc `C` эту проверку не проходит. При создании локальной базы через pgAdmin также выберите UTF8 и Unicode-локаль, например ICU `ru-RU`.

```sql
REVOKE CONNECT, TEMPORARY ON DATABASE esoft FROM PUBLIC;
GRANT CONNECT ON DATABASE esoft TO esoft_migrator, esoft;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO esoft;

ALTER DEFAULT PRIVILEGES FOR ROLE esoft_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO esoft;
ALTER DEFAULT PRIVILEGES FOR ROLE esoft_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO esoft;
```

В текущей конфигурации и backend, и инфраструктурные команды используют один `DATABASE_URL` из корневого `.env`. Для первоначального `npm run setup` укажите в нём реквизиты `esoft_migrator`. После setup выполните в базе `esoft` под администратором PostgreSQL:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO esoft;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO esoft;
REVOKE ALL PRIVILEGES ON TABLE public._prisma_migrations FROM esoft;
```

Перед запуском backend замените `DATABASE_URL` на реквизиты `esoft`. Пароль роли миграций не должен оставаться в окружении работающего приложения.

При обновлении остановите backend, временно используйте реквизиты `esoft_migrator`, примените миграции через setup и верните прикладной `DATABASE_URL` до запуска backend. Backup/restore и диагностику статуса миграций также выполняйте с операторскими реквизитами: прикладная роль не имеет доступа к `_prisma_migrations`. После восстановления проверьте и при необходимости повторно выдайте права на существующие таблицы и последовательности и убедитесь, что доступ к `_prisma_migrations` отсутствует. Не запускайте приложение, пока прикладные права не проверены.

Перед backup/restore полностью остановите backend, оставив PostgreSQL и MinIO работающими. Общая блокировка установки не позволяет запустить backend во время операции и не позволяет скриптам работать при запущенном backend. После штатной остановки lock снимается автоматически; после принудительного завершения сначала проверьте, что процесс и его дочерние команды остановлены, и только затем удаляйте оставшийся `.local/.production-operation.lock`. Не допускайте ручных SQL/S3-изменений и работы другой установки с теми же данными во время копирования или восстановления. Если restore или его автоматический откат не завершились, маркер `.local/.restore-recovery-required.json` блокирует запуск backend. Не удаляйте его для обхода защиты: устраните причину и выполните восстановление из защитной копии, путь которой выведен скриптом и сохранён в маркере. Маркер снимается автоматически после успешной проверки данных. Backend запускайте после успешного завершения операции и необходимых проверок прав.


Эти команды предназначены для новой базы. Для существующей базы сначала отдельно перенесите владение объектами на роль миграций; простое создание второй роли не ограничит владельца существующих объектов.

Новые изменения схемы оформляются SQL-миграциями в пакете-владельце; используйте порядок из [DATABASE-PACKAGES.md](DATABASE-PACKAGES.md). Пользователю backend права на изменение схемы не выдаются.

### MinIO

MinIO используется для хранения файлов проекта. Для Windows требуется серверный файл `minio.exe`.

Скачайте **MinIO Server для Windows amd64** по прямой ссылке:

<https://dl.min.io/server/minio/release/windows-amd64/minio.exe>

После загрузки:

1. Создайте в удобном месте папку `MinIO`.
2. Переместите в неё скачанный файл `minio.exe`.
3. Рядом с файлом `minio.exe` создайте папку `data`.

Итоговая структура папки должна выглядеть так:

```text
MinIO
├── minio.exe
└── data
```

## 3. Настройка `.env`

Создайте файл .env на основе файла .env.example.

Откройте созданный файл .env и замените значения-заглушки.

### PostgreSQL

    Укажите строку подключения к созданной ранее базе данных:

    DATABASE_URL=postgresql://esoft:change_me@127.0.0.1:5432/esoft?schema=public

    Замените change_me на пароль пользователя PostgreSQL esoft.

    Если при настройке PostgreSQL использовались другие имя пользователя, порт или название базы данных, измените соответствующие значения в строке подключения.

### MinIO

    Укажите учетные данные MinIO:

    MINIO_ROOT_USER=esoft
    MINIO_ROOT_PASSWORD=change_me
    MINIO_SECRET_KEY=change_me

    Замените change_me на самостоятельно придуманный пароль.

    В параметрах MINIO_EXECUTABLE и MINIO_DATA_DIR укажите полные пути:

    MINIO_EXECUTABLE=C:/путь/к/MinIO/minio.exe
    MINIO_DATA_DIR=C:/путь/к/MinIO/data

    MINIO_EXECUTABLE — путь к файлу minio.exe;
    MINIO_DATA_DIR — путь к созданной рядом папке data.

    В путях рекомендуется использовать прямые слеши /.

### Секретные ключи

    Укажите секрет для системы авторизации и ключ доступа приложения к MinIO:

    BETTER_AUTH_SECRET=change_me_to_a_long_random_secret
    MINIO_ACCESS_KEY=esoft_app

    Значение BETTER_AUTH_SECRET необходимо заменить на длинную случайную строку.

    Для локального запуска значение MINIO_ACCESS_KEY можно оставить равным esoft_app.

### Порты и адреса

    Следующие значения можно оставить без изменений, если указанные порты свободны:

    BACKEND_PORT=3000
    FRONTEND_PORT=5173
    MINIO_PORT=9000
    MINIO_CONSOLE_PORT=9001
    BACKEND_URL=http://127.0.0.1:3000
    FRONTEND_URL=http://127.0.0.1:5173
    VITE_API_URL=http://127.0.0.1:3000
    BETTER_AUTH_URL=http://127.0.0.1:3000

## 4. Проверка конфигурации

Выполните:

```powershell
npm run config:validate
```

Команда проверяет `.env` по профилю: при `NODE_ENV=production` используется `production`, иначе `local`. Для локального запуска проверяются также путь к `minio.exe`, каталог данных и root-реквизиты. Профиль можно задать явно через `-- --profile local`, `backend`, `frontend`, `production`, `database` или `storage-operation`; состав описан в `CONFIGURATION.md`.

## 5. Первый локальный запуск проекта

Выполните:

```powershell
npm ci
npm run setup
npm run dev
```

`npm run setup` проверяет PostgreSQL, обеспечивает доступность MinIO, создаёт бакет MinIO при необходимости, генерирует Prisma Client, применяет миграции, запускает seed и проверяет обязательные данные.

`npm run dev` запускает MinIO, backend и frontend для разработки. Для остановки проекта нажмите `Ctrl+C`.

## 6. Проверка работоспособности

После запуска откройте:

http://127.0.0.1:5173

Backend:

http://127.0.0.1:3000

Health endpoint:

http://127.0.0.1:3000/health

MinIO Console:

http://127.0.0.1:9001

Для входа в MinIO Console используйте `MINIO_ROOT_USER` и `MINIO_ROOT_PASSWORD` из `.env`.

## 7. Повторный локальный запуск

После первого запуска достаточно:

```powershell
npm run dev
```

Повторно запускайте `npm run setup`, если изменились миграции, seed, Prisma schema, `.env`, MinIO bucket-настройки или вы получили обновления проекта.

## 8. Обновление проекта

### Локальная разработка

Остановите запущенный проект, затем выполните:

```powershell
git pull
npm ci
npm run setup
```

Повторный `npm run setup` применяет недостающие миграции, обновляет Prisma Client и проверяет обязательное состояние. Используйте реквизиты локальной роли, которой разрешено применять миграции.

### Production

Шаблоны Windows-служб, HTTPS proxy, резервного копирования и порядок отката описаны в [WINDOWS-PRODUCTION.md](WINDOWS-PRODUCTION.md). Они требуют адаптации администратором и не устанавливаются npm-командами.

1. Остановите backend и выполните резервное копирование перед обновлением. PostgreSQL и MinIO оставьте работающими.
2. Получите изменения проекта через `git pull`.
3. Временно укажите в `DATABASE_URL` реквизиты `esoft_migrator`.
4. Выполните `npm ci` и `npm run setup:prod`. При ошибке остановите процедуру обновления и разберитесь с причиной; не расширяйте права прикладного `esoft` для запуска миграций.
5. Верните в `DATABASE_URL` реквизиты прикладного `esoft` до запуска backend.
6. Выполните production-сборку, убедитесь, что обязательные данные и прикладные права соответствуют требованиям раздела о ролях PostgreSQL, затем запустите backend через настроенный механизм production-запуска.
7. Проверьте health endpoint и работу приложения через внешний адрес.

Повторный `npm run setup:prod` в production выполняйте с реквизитами `esoft_migrator` при остановленном backend. Прикладная роль `esoft` предназначена для работы приложения, а не для миграций.
