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
