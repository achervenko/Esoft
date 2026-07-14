# Esoft

Esoft is a local equipment accounting app.

- `backend` - NestJS API, Better Auth, Prisma
- `frontend` - React + Vite
- `esoft.config.json` - local launcher config

## Requirements

- Node.js
- PostgreSQL
- MinIO, installed by project script

## Config

Main settings are stored in:

```text
esoft.config.json
```

This file is local and is ignored by Git because it can contain passwords and
auth secrets. Use `esoft.config.example.json` as a template.

Edit this file when you need to change:

- frontend/backend ports
- local network host
- database host, port, name, user and password
- auth secret
- MinIO endpoint, bucket, credentials, executable path and data path
- browser startup behavior

The launcher syncs generated env files on every start:

- `backend/.env`
- `frontend/.env`

Do not edit generated env files unless you need a temporary manual override.

## MinIO

MinIO is used as local S3-compatible file storage.

The repository does not store:

- `tools/minio.exe`
- `minio/` object storage data

These paths are local runtime files and are ignored by Git.

Install or update MinIO from the project root:

```powershell
npm run install:minio
```

The installer downloads the official Windows binary from:

```text
https://dl.min.io/server/minio/release/windows-amd64/minio.exe
```

It uses `esoft.config.json`:

- `storage.executablePath` - where `minio.exe` is saved
- `storage.dataPath` - where object data is stored
- `storage.accessKey` and `storage.secretKey` - MinIO admin login

Start MinIO:

```powershell
npm run start:minio
```

Default local addresses:

```text
API:     http://127.0.0.1:9000
Console: http://127.0.0.1:9001
```

On first setup, open the MinIO console and create the bucket from
`storage.bucket` in `esoft.config.json` usually:

```text
esoft
```

## Start

Make sure PostgreSQL is running and the database from `esoft.config.json` exists.

If the database does not exist yet, run this script in pgAdmin as a PostgreSQL
administrator:

```text
database/setup-postgres.sql
```

Then apply Prisma migrations:

```powershell
cd backend
npm run prisma:migrate
```

From the project root:

```powershell
npm run start:minio
npm run start:simple
```

The launcher will:

- stop old Esoft processes on configured ports
- sync env files from `esoft.config.json`
- start backend
- start frontend
- open the browser when enabled

Logs are written to:

```text
logs
```

## Production-like Server Start

Use this path for a small Windows server without Docker.

Prepare the server once:

- install Node.js LTS;
- install PostgreSQL;
- run `database/setup-postgres.sql` if the database and user do not exist yet;
- run `npm run install:minio`;
- copy `esoft.config.example.json` to `esoft.config.json`;
- fill database, auth and MinIO settings in `esoft.config.json`.

Then start Esoft from the project root:

```powershell
npm run start:production
```

The production launcher:

- syncs `backend/.env` and `frontend/.env` from `esoft.config.json`;
- starts MinIO from the configured executable and data folder;
- installs npm dependencies if `node_modules` is missing;
- generates Prisma client;
- applies migrations with `prisma migrate deploy`;
- builds backend and frontend;
- starts backend from `dist/main`;
- starts frontend from the built `dist` via Vite preview;
- opens the browser if `app.openBrowser` is enabled.

For this deployment mode the operator usually changes only one file:

```text
esoft.config.json
```

Keep backups of:

- PostgreSQL database;
- MinIO data folder from `storage.dataPath`;
- `esoft.config.json`.

## Manual Dev Start

Use this only when you need to debug parts separately:

```powershell
npm run backend:dev
npm run frontend:dev
```

## Prisma

```powershell
cd backend
npm run prisma:generate
npm run prisma:migrate
```

## Auth

Better Auth is mounted in the NestJS backend at:

```text
/api/auth
```

Enabled:

- email/password auth
- username/password auth
- admin role plugin
- NestJS auth guard integration

React client helper:

```text
frontend/src/lib/auth-client.ts
```

## UI typography

Use the same text scale across new frontend screens:

- Page title, for example registry or profile header: `30px`, `line-height: 1.2`, `font-weight: 800`, color `#15171c`.
- Entity/card title, for example equipment card title or profile name: `30px`, `line-height: 1.2`, `font-weight: 800`, color `#15171c`.
- Card section title, for example `Основные данные` or `Данные пользователя`: `18px`, `font-weight: 800`, color `#15171c`.
- Field label: `12px`, `font-weight: 800`, color `#6b7280`.
- Field value: `15px`, `font-weight: 650`, color `#15171c`.
- Secondary description text: `14px`, `line-height: 1.4`, `font-weight: 650`, color `#6b7280`.

When adding a new page, copy these settings from the equipment registry and
equipment card styles instead of inventing a separate text scale.
