# Установка проекта

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
     - **Superuser?** — `Yes`.

4. Создайте новую базу данных:
   - имя базы данных — `esoft`;
   - владелец — созданный пользователь `esoft`.

При заполнении файла `.env` рекомендуется использовать адрес сервера `127.0.0.1` вместо `localhost`.

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

Команда проверяет наличие `.env`, обязательные переменные, формат URL, порты, секреты, путь к `minio.exe` и каталог данных MinIO.

## 5. Первый запуск проекта

Выполните:

```powershell
npm install
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

## 7. Повторный запуск

После первого запуска достаточно:

```powershell
npm run dev
```

Повторно запускайте `npm run setup`, если изменились миграции, seed, Prisma schema, `.env`, MinIO bucket-настройки или вы получили обновления проекта.

## 8. Обновление проекта

После получения изменений выполните:

```powershell
git pull
npm install
npm run setup
```

`npm run setup` безопасно запускать повторно. Он применит недостающие миграции, обновит Prisma Client и проверит обязательное состояние.