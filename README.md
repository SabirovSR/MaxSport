# MAX Sport

Любительский спорт в мессенджере MAX: лобби, слоты, явка.

Mini App: https://max-sport.sabirov.tech

## Быстрый старт (локально)

```bash
npm install
cp .env.example .env

# Postgres + Redis + API (Docker)
docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.dev.yml up --build

# или только API (нужны Postgres и Redis)
npm run dev
npm run dev:app
```

Миграции:

```bash
npm run migrate -w @maxsport/api
# или RUN_MIGRATIONS=true в docker
```

Проверки:

```bash
npm run check      # typecheck + boundaries + tests
npm run build      # api + mini-app
```

## Структура

- `apps/api` — Fastify: webhook, REST, scheduler, healthz
- `apps/mini-app` — React + MAX UI (`/app`)
- `packages/*` — доменные deep modules ([packages/README.md](packages/README.md))
- `deploy/` — Docker, Caddy, миграции

## Документация

- Язык домена: [CONTEXT.md](CONTEXT.md)
- Продукт: [docs/PRODUCT.md](docs/PRODUCT.md)
- Стек: [docs/STACK.md](docs/STACK.md)
- Прод: [docs/ops/PRODUCTION.md](docs/ops/PRODUCTION.md)
- Демо-сценарий питча: [docs/DEMO.md](docs/DEMO.md)

## Деплой

Push в `main` → GitHub Actions → GHCR → SSH на VPS. См. [docs/ops/SETUP.md](docs/ops/SETUP.md).
