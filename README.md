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

Миграции (только схема):

```bash
npm run migrate
```

Demo seed для питча (после первого входа в Mini App):

```bash
npm run seed:demo
```

Проверки:

```bash
npm run check      # typecheck + boundaries + tests
npm run build      # api + mini-app + landing
```

## Структура

```
apps/
  api/            Fastify: webhook, REST, scheduler, healthz
    src/http/     JSON Schema, ошибки 400, rate limit
  mini-app/       React + MAX UI (`/app`)
  landing/        публичный лендинг
packages/         доменные модули (lobby, presence, karma, …)
deploy/           Docker, Caddy, миграции
docs/             продукт, стек, инфраструктура, ADR
```

## Документация

- Описание приложения: [docs/PRODUCT.md](docs/PRODUCT.md)
- Язык домена: [docs/DOMAIN.md](docs/DOMAIN.md)
- Стек и слои: [docs/STACK.md](docs/STACK.md)
- Инфраструктура: [docs/INFRA.md](docs/INFRA.md)
- Пакеты (deep modules): [packages/README.md](packages/README.md)
- Запуск и прод: [docs/ops/SETUP.md](docs/ops/SETUP.md), [docs/ops/PRODUCTION.md](docs/ops/PRODUCTION.md)
- Демо-сценарий: [docs/DEMO.md](docs/DEMO.md)

## Деплой

Push в `main` → GitHub Actions → GHCR → SSH на VPS. См. [docs/ops/SETUP.md](docs/ops/SETUP.md).
