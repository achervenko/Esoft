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
