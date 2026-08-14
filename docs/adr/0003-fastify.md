# HTTP-сервер: Fastify

---
status: accepted
---

Один Node-процесс принимает webhook MAX и REST Mini App. Фреймворк — **Fastify**. `bot.start()` официального SDK не вызываем: это Long Polling.

## Considered Options

1. **NestJS** — много модулей и DI для двухнедельного хакатона; тормозит MVP.
2. **Express** — все знают, но слабая типизация и нет схемы запроса из коробки. Для брони Слота это лишний риск.
3. **Hono** — лёгкий и быстрый, заточен под edge. Мы на VPS с Postgres и Redis, не на Cloudflare.
4. **Fastify (выбрано)** — TypeScript, JSON Schema на маршрутах, плагины, один процесс: `POST /webhook` + `/api/*` + `/healthz`.

## Consequences

- Webhook — обычный `POST` Fastify: проверка `X-Max-Bot-Api-Secret`, тело Update в `@maxhub/max-bot-api`.
- TLS наружу по-прежнему на reverse-proxy (Caddy/nginx), Fastify слушает localhost.
- ORM и очередь — отдельные решения, не часть этого ADR.
