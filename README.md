# Esoft

Project scaffold:

- `backend` - NestJS API with Prisma
- `frontend` - React + Vite
- `docker-compose.yml` - local PostgreSQL

## Start

```bash
cp .env.example .env
cp backend/.env.example backend/.env
npm run db:up
npm run backend:dev
npm run frontend:dev
```

## Prisma

```bash
cd backend
npm run prisma:generate
npm run prisma:migrate
```

## Auth

Better Auth is mounted in the NestJS backend at:

```text
http://localhost:3000/api/auth
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
