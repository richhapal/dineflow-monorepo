# DineFlow Monorepo

Restaurant operating system — powered by Turborepo.

## Apps

| App | Port | Description |
|-----|------|-------------|
| `apps/api` | 4000 | NestJS backend API + WebSockets |
| `apps/dashboard` | 3000 | Next.js restaurant management dashboard |
| `apps/mobile` | — | Expo React Native (iOS + Android) |
| `apps/web` | 3001 | Next.js public landing site |

## Packages

| Package | Description |
|---------|-------------|
| `packages/types` | Shared TypeScript interfaces and enums |
| `packages/utils` | Shared utilities (GST calc, image URLs, formatters) |
| `packages/config` | App constants, WebSocket events, plan limits |

## Quick start

### Prerequisites
- Node.js >= 18
- pnpm >= 9 (`npm install -g pnpm`)
- PostgreSQL (Supabase free tier recommended)
- Redis (Upstash free tier recommended)

### Setup

```bash
# 1. Install all dependencies
pnpm install

# 2. Set up environment files
cp apps/api/.env.example apps/api/.env
cp apps/dashboard/.env.local.example apps/dashboard/.env.local

# 3. Run Prisma migrations
pnpm --filter @dineflow/api migrate

# 4. Start everything in parallel
pnpm dev
```

### Run individual apps

```bash
pnpm dev:api        # Start API only (port 4000)
pnpm dev:dashboard  # Start dashboard only (port 3000)
pnpm dev:web        # Start landing site (port 3001)
pnpm dev:mobile     # Start Expo (scan QR with Expo Go)
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│  apps/dashboard (Next.js, port 3000)            │
│  apps/web (Next.js, port 3001)                  │
│  apps/mobile (Expo React Native)                │
└─────────────────┬───────────────────────────────┘
                  │ REST + WebSocket
┌─────────────────▼───────────────────────────────┐
│  apps/api (NestJS, port 4000)                   │
│  ├── REST API (/api/*)                          │
│  ├── WebSocket Gateway (/ws)                    │
│  └── BullMQ background jobs                    │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│  PostgreSQL (Supabase)  +  Redis (Upstash)      │
└─────────────────────────────────────────────────┘
```

## Key files

```
apps/api/src/
  main.ts                      ← NestJS bootstrap + Swagger
  app.module.ts                ← Root module, all feature modules
  prisma/prisma.service.ts     ← PrismaClient singleton
  common/guards/               ← JwtGuard, RestaurantGuard
  common/decorators/           ← @CurrentRestaurant, @CurrentUser
  modules/orders/              ← Orders CRUD + idempotency
  modules/websocket/           ← Socket.io gateway
  prisma/schema.prisma         ← Full 45-model schema

apps/dashboard/src/
  lib/api.ts                   ← Axios client with JWT interceptor
  lib/store.ts                 ← Zustand global state
  hooks/useSocket.ts           ← WebSocket connection hook
  app/(pages)/                 ← Next.js App Router pages

apps/mobile/src/
  store/index.ts               ← Zustand + SecureStore for mobile
  screens/auth/PINLoginScreen  ← 4-digit PIN login

packages/types/src/index.ts   ← All shared interfaces + enums
packages/utils/src/index.ts   ← GST calc, formatINR, Cloudinary URLs
packages/config/src/index.ts  ← WS events, socket rooms, plan limits
```

## Deployment

| App | Platform | Config |
|-----|----------|--------|
| API | Railway | `railway.json` (add when deploying) |
| Dashboard | Vercel | auto-detects Next.js |
| Web | Vercel | auto-detects Next.js |
| Mobile iOS | EAS Build | `apps/mobile/eas.json` |
| Mobile Android | EAS Build | `apps/mobile/eas.json` |
| Database | Supabase | `DATABASE_URL` env var |
| Redis | Upstash | `REDIS_*` env vars |
| Images | Cloudinary | `CLOUDINARY_*` env vars |
