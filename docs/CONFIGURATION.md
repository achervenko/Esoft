# Конфигурация Esoft

## Назначение

Проект использует единый локальный файл конфигурации в корне репозитория:

```text
Esoft/.env
```

Шаблон хранится рядом:

```text
Esoft/.env.example
```

Рабочий `.env` содержит локальные адреса, пароли и секретные ключи, поэтому он
не должен попадать в Git. Шаблон `.env.example` не содержит рабочих секретов и
должен храниться в Git.

Для локального запуска значения из корневого `.env` имеют приоритет над уже
установленными системными переменными окружения. Это сделано намеренно, чтобы
запуск из корня проекта и из подкаталогов использовал один локальный источник
настроек.

## Создание `.env`

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS/Linux:

```bash
cp .env.example .env
```

После копирования замените значения-заглушки:

```text
DATABASE_URL
BETTER_AUTH_SECRET
MINIO_ROOT_PASSWORD
MINIO_SECRET_KEY
```

Файл `.env` должен использовать простой dotenv-синтаксис:

```env
KEY=value
KEY="value with spaces"
```

Сложный синтаксис поддерживается не полностью. Не используйте многострочные
значения, подстановки `${VARIABLE}` и нестандартные встроенные комментарии.

## Проверка

```bash
npm run config:validate
```

Проверка не подключается к PostgreSQL или MinIO. Она валидирует только наличие и
формат переменных.

## Переменные

### Режим приложения

- `NODE_ENV` — режим приложения. Обязательная переменная. Допустимые значения:
  `development`, `test`, `production`.

### Backend

- `BACKEND_HOST` — адрес, на котором слушает backend. Обязательная переменная.
- `BACKEND_PORT` — порт backend. Обязательная переменная.
- `BACKEND_URL` — внешний URL backend. Обязательная переменная.

### Frontend

- `FRONTEND_HOST` — адрес сервера разработки frontend. Обязательная переменная.
- `FRONTEND_PORT` — порт сервера разработки frontend. Обязательная переменная.
- `FRONTEND_URL` — внешний URL frontend. Обязательная переменная.
- `VITE_API_URL` — URL API для кода браузера. Обязательная переменная.

### PostgreSQL

- `DATABASE_URL` — строка подключения к PostgreSQL. Обязательная переменная,
  содержит пароль.
- `POSTGRES_SERVICE_NAME` — имя Windows-службы PostgreSQL для временного запуска
  через `npm run doctor`. Необязательная переменная.

### Авторизация

- `BETTER_AUTH_SECRET` — секрет Better Auth. Обязательная секретная переменная.
- `BETTER_AUTH_URL` — базовый URL Better Auth. Обязательная переменная.

### MinIO

- `MINIO_HOST` — адрес MinIO API. Обязательная переменная.
- `MINIO_PORT` — порт MinIO API. Обязательная переменная.
- `MINIO_CONSOLE_PORT` — порт MinIO Console. Обязательная переменная.
- `MINIO_USE_SSL` — включает HTTPS для MinIO. Обязательная переменная.
- `MINIO_ROOT_USER` — root user локального MinIO. Обязательная переменная, не
  является секретом.
- `MINIO_ROOT_PASSWORD` — root password локального MinIO. Обязательная секретная
  переменная.
- `MINIO_ACCESS_KEY` — идентификатор доступа S3 для backend. Обязательная переменная, не
  является секретом.
- `MINIO_SECRET_KEY` — секретный ключ S3 для backend. Обязательная секретная
  переменная.
- `MINIO_BUCKET` — основной bucket MinIO. Обязательная переменная.
- `MINIO_EXECUTABLE` — путь к локальному `minio.exe`. Обязательная переменная.
- `MINIO_DATA_DIR` — папка данных MinIO. Обязательная переменная.

## Frontend и секреты

Во frontend доступны только переменные с префиксом `VITE_`.

Нельзя добавлять префикс `VITE_` к:

```text
DATABASE_URL
BETTER_AUTH_SECRET
MINIO_ROOT_PASSWORD
MINIO_SECRET_KEY
```

## Типовые ошибки

### Нет корневого `.env`

```text
Корневой файл .env не найден. Создайте его из .env.example.
```

Решение:

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS/Linux:

```bash
cp .env.example .env
```

### Неверный порт

```text
BACKEND_PORT: Порт должен быть целым числом от 1 до 65535.
```

Решение: укажите число, например:

```env
BACKEND_PORT=3000
```

### Секрет не заменён

```text
BETTER_AUTH_SECRET: Замените значение-заглушку на локальное рабочее значение.
```

Решение: замените значение на длинный случайный секрет.

### Адреса процессов и публичные URL

`BACKEND_HOST` / `BACKEND_PORT` задают внутренний HTTP listener backend. `FRONTEND_HOST` / `FRONTEND_PORT` задают listener Vite dev/preview; при отдаче production frontend веб-сервером эти параметры не определяют его публичный адрес.

`BACKEND_URL`, `FRONTEND_URL`, `VITE_API_URL` и `BETTER_AUTH_URL` — адреса, доступные пользователю. Они могут отличаться от адресов и портов процессов. `FRONTEND_URL` также задаёт доверенный origin для CORS/авторизации; `BETTER_AUTH_URL` — публичный origin авторизации.

#### Локальная разработка без reverse proxy

Публичные URL обычно соответствуют адресам и портам процессов:

```env
BACKEND_HOST=127.0.0.1
BACKEND_PORT=3000
BACKEND_URL=http://127.0.0.1:3000
FRONTEND_HOST=127.0.0.1
FRONTEND_PORT=5173
FRONTEND_URL=http://127.0.0.1:5173
VITE_API_URL=http://127.0.0.1:3000
BETTER_AUTH_URL=http://127.0.0.1:3000
```

Для прямого доступа с телефона по LAN используйте доступный IP компьютера в публичных URL и настройте listener/firewall для подключения извне. Listener может быть `0.0.0.0`, но этот адрес не является публичным URL.

#### Production за reverse proxy

Proxy принимает HTTPS на домене, отдаёт frontend и направляет `/api` (включая `/api/auth`) на внутренний backend без изменения пути:

```env
BACKEND_HOST=127.0.0.1
BACKEND_PORT=3000
BACKEND_URL=https://insolution-esoft.ru
FRONTEND_HOST=127.0.0.1
FRONTEND_PORT=5173
FRONTEND_URL=https://insolution-esoft.ru
VITE_API_URL=https://insolution-esoft.ru
BETTER_AUTH_URL=https://insolution-esoft.ru
```

Совпадение публичного URL с host/port процесса не требуется. TLS завершается на proxy; backend продолжает слушать внутренний HTTP. Домен должен разрешаться и быть доступен в сети предприятия. После изменения `VITE_API_URL` пересоберите frontend.

Внутренние адреса `config.backend.internalUrl` и `config.frontend.internalUrl` вычисляются из host/port. Для wildcard `0.0.0.0` используется `127.0.0.1`, для `::` — `::1`. Vite proxy и локальный doctor используют эти HTTP-адреса. `doctor:prod` проверяет публичные `BACKEND_URL` и `FRONTEND_URL`, включая доступность настроенного proxy с машины запуска команды.

## Управление проектом

Все основные команды выполняются из корня репозитория:

```bash
npm ci
npm run dev
npm run doctor
npm run build
npm run lint
npm run test
npm run test:e2e
npm run start
```

`dev` и `start` используют общий модуль запуска процессов из `scripts/process`.
Единственный источник конфигурации приложения — корневой `.env`.

`doctor` временно поднимает только недостающие компоненты, проверяет PostgreSQL,
MinIO, backend и frontend, затем восстанавливает исходное состояние.
`POSTGRES_SERVICE_NAME` нужен только для `doctor`, если PostgreSQL остановлен и
его нужно временно запустить как Windows-службу.
