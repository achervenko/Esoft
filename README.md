# Esoft

Esoft is a local equipment accounting app.

- `backend` - NestJS API, Better Auth, Prisma
- `frontend` - React + Vite
- `esoft.config.json` - local launcher config

## Requirements

- Node.js
- PostgreSQL

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
- browser startup behavior

The launcher syncs generated env files on every start:

- `backend/.env`
- `frontend/.env`

Do not edit generated env files unless you need a temporary manual override.

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
