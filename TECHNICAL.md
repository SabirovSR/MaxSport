# MAX Sport — техническая справка

Снимок репозитория: монорепозиторий TypeScript, один процесс Fastify (webhook MAX + REST Mini App), PostgreSQL/PostGIS и Redis. Публичный адрес: https://max-sport.sabirov.tech

## Что это

Мини-приложение и бот в мессенджере MAX: сбор состава на любительскую игру (лобби и слоты), площадка, явка, надёжность в игровом паспорте.

Термины: организатор, игрок, лобби, слот, амплуа, площадка, сплит, залог, явка, ростер, карма, надёжность, игровой паспорт, карточка чата.

Виды спорта: волейбол, мини-футбол, баскетбол, падел/теннис, флорбол, хоккей, водное поло, настольный теннис, страйкбол, пейнтбол. Уровень лобби: новичок, любитель, продвинутый или любой.

## Стек

| Слой              | Технология                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| Язык              | TypeScript, Node.js ≥ 20 (CI — Node 22)                                                                 |
| HTTP              | Fastify 5: webhook, REST, статика Mini App и лендинга, `/healthz`                                       |
| Валидация         | `@sinclair/typebox`, JSON Schema на маршрутах. Битый JSON и неверные поля → `400`                       |
| Лимиты            | `@fastify/rate-limit` + Redis                                                                           |
| Mini App          | React 19, React Router 7, `@maxhub/max-ui`, MAX Bridge, Vite 6, SWR, Service Worker (`vite-plugin-pwa`) |
| Бот               | `@maxhub/max-bot-api`, только webhook. `bot.start()` (long polling) не вызывается                       |
| БД                | PostgreSQL 16 + PostGIS (`postgis/postgis:16-3.4-alpine`)                                               |
| Очереди / live    | Redis 7: Pub/Sub счётчика лобби, счётчики rate limit                                                    |
| Карты             | Яндекс: JS API в браузере, Suggest / Geocoder / Static только через API                                 |
| TLS               | Caddy 2, Let's Encrypt                                                                                  |
| Пакетный менеджер | npm workspaces                                                                                          |
| Тесты             | Vitest                                                                                                  |
| Границы модулей   | dependency-cruiser                                                                                      |

Один язык на клиент, бот и API. Nest, Express и Hono не используются. Mini App не ходит в Bot API: токен бота только на сервере.

## Архитектура

```
Игрок в MAX
  ├─ Mini App (WebView) ── initData ──► Fastify /api/*
  └─ чат / бот ── webhook ──► Fastify POST /webhook
                                    │
                    packages: lobby, presence, karma, …
                                    │
                         PostgreSQL + Redis
                                    │
                         platform-api2.max.ru  (карточка чата, сообщения)
```

Домен не зависит от мессенджера. MAX — адаптер на краю (`packages/max-channel`). Второй транспорт (Telegram, `POST /webhook/telegram`) в коде заложен, на защите и в продуктовых текстах не показывается.

Решения (ADR):

1. Явка через бота, без QR. Окно явки: −20 мин … +15 мин от старта. Гео усиливает «я на месте», отказ гео не блокирует отметку.
2. Только webhook. MAX не держит webhook и long polling вместе. Молчание endpoint 8 часов снимает подписку — её вешают при старте и обновляют каждые 4 часа.
3. Один процесс Fastify.
4. Доставка: GitHub Actions → GHCR → SSH на VPS.
5. Каналы — адаптеры, домен общий.

Карточка чата обновляется через `PUT /messages` бота, не через сокет. Live-лента Mini App — SSE `GET /api/lobbies/:id/stream` и Redis Pub/Sub.

Личные сообщения бота идут через `sendMessageToUser` (user id). `sendMessageToChat(chat_id)` на личке даёт 404.

## Репозиторий

```
apps/api          Fastify: server, routes, webhook, auth, migrate, seed
  src/http/       схемы TypeBox, маппинг ошибок, rate limit
apps/mini-app     React Mini App, base /app
apps/landing      публичный лендинг
packages/         доменные модули
deploy/           Dockerfile, Caddyfile, docker-compose, migrations/
docs/             продукт, стек, инфраструктура, ADR, ops
```

Пакеты (импорт только из корня пакета, не из `lib/`):

| Пакет                     | Роль                                        |
| ------------------------- | ------------------------------------------- |
| `@maxsport/shared`        | типы, ошибки, пул Postgres, сплит, роли     |
| `@maxsport/brand`         | дизайн-токены                               |
| `@maxsport/lobby`         | лобби, слоты, заявки, инбокс организатора   |
| `@maxsport/presence`      | явка и ростер                               |
| `@maxsport/karma`         | голоса, надёжность, навыки, паспорт         |
| `@maxsport/venue`         | площадки                                    |
| `@maxsport/geo`           | прокси Яндекса и кэш                        |
| `@maxsport/payment`       | залоги                                      |
| `@maxsport/notifications` | напоминания и пинги                         |
| `@maxsport/chat-card`     | карточка чата MAX                           |
| `@maxsport/max-channel`   | клиент MAX, проверка initData, адаптер бота |
| `@maxsport/realtime`      | Redis Pub/Sub                               |

Проверка границ: `npm run lint:boundaries`.

## Аутентификация и лимиты

REST требует заголовок `X-Init-Data` (initData из MAX Bridge). Сервер проверяет HMAC токеном бота и поднимает пользователя. В логах query `initData` маскируется.

Rate limit, ключ — хеш initData, иначе IP. Redis namespace `ms-rl-`. Если Redis недоступен, лимит пропускается (`skipOnError`).

| Правило                                 | Лимит                 |
| --------------------------------------- | --------------------- |
| Все `/api/*`                            | 120 запросов / минуту |
| `POST /api/lobbies`, `POST /api/venues` | 20 / минуту           |
| `POST /api/karma/vote`                  | 40 / минуту           |
| `/healthz`, `/webhook`, `/open`         | без лимита            |

## HTTP

Снаружи только 443 (и 80 для ACME). Fastify слушает `0.0.0.0:3000` внутри Docker, наружу порт не публикуется.

| Путь            | Назначение                                 |
| --------------- | ------------------------------------------ |
| `/`             | лендинг                                    |
| `/app`          | Mini App                                   |
| `/healthz`      | `{ ok: true }`                             |
| `/open`         | редирект на `https://max.ru/<bot>`         |
| `POST /webhook` | апдейты MAX, секрет `X-Max-Bot-Api-Secret` |
| `/api/*`        | REST Mini App                              |

Основные маршруты API (все, кроме отмеченных, под auth):

- Лента: `GET /api/lobbies`, `GET /api/me/lobbies`, `GET /api/me/inbox`, `GET /api/lobbies/:id`
- Создание и правка: `POST /api/lobbies`, `PATCH /api/lobbies/:id`
- Слот: `POST .../slots/:slotId/book`, `POST .../request`, `PATCH .../role`, `DELETE .../slots/:slotId`
- Заявки: `GET/POST/DELETE /api/lobbies/:id/join-requests...` (accept / reject / me)
- Жизненный цикл: `POST .../start|cancel|finish|notify-players|card`
- Явка: `POST /api/presence/:slotId/on-site|on-the-way|manual`, `GET .../roster`
- Паспорт: `GET /api/passport/me`, `GET /api/passport/:userId`, навыки `GET/PUT/DELETE /api/passport/skills/:sport`
- Надёжность: `GET /api/lobbies/:id/karma/status`, `POST /api/karma/vote`
- Площадки: `GET /api/venues`, `GET /api/venues/map`, `POST /api/venues`
- Гео: `GET /api/geo/suggest|geocode|reverse|static`
- Деньги: `GET /api/lobbies/:id/payments`, `POST .../payments/collect`
- Конфиг браузера: `GET /api/config` (только JS-ключ карт и username бота)
- Live: `GET /api/lobbies/:id/stream` (SSE)

Диплинк: `https://max.ru/<bot>?startapp=lobby_<id>` или `roster_<id>`. Параметр `startapp` открывает лобби или ростер и в этом случае не показывает онбординг.

## Данные

Миграции в `deploy/migrations/`, только DDL, идемпотентные. Демо-данные отдельно: `npm run seed:demo`.

| Файл                            | Содержание                                                |
| ------------------------------- | --------------------------------------------------------- |
| `001_init.sql`                  | users, venues, lobbies, slots, явка, карма, платежи, jobs |
| `002_geo_index.sql`             | геоиндекс                                                 |
| `003_one_slot_per_user.sql`     | один слот на игрока в лобби                               |
| `004_expand_sports.sql`         | расширение видов спорта                                   |
| `005_user_sport_skills.sql`     | навыки по видам спорта                                    |
| `006_join_requests.sql`         | заявки на слот                                            |
| `007_dedupe_slots_per_user.sql` | дедуп слотов                                              |
| `008_unique_active_lobby.sql`   | уникальность активного лобби                              |
| `009_lobby_any_level.sql`       | уровень «любой»                                           |

Надёжность (`reliability_pct`) считается из явки и голосов кармы, не из текстовых отзывов.

## Mini App

Роутер с `basename=/app`. Экраны: лента, создание, паспорт, лобби, ростер, карма, редактирование лобби.

Онбординг из трёх слайдов показывается, если `gamesPlayed === 0` и в `localStorage` нет `ms-onboarding-seen`. Повтор: паспорт → «Как это работает». Превью: `/?onboarding=1`.

Кэш: SWR (stale-while-revalidate, ключи в `localStorage`) и Service Worker на статику. При обрыве сети остаются последние данные, ошибка — тост, не замена всего экрана.

Иконки амплуа — общий `RoleMark`. Заливка лайма `#c8f54a` не зависит от темы. Пустые слоты с иконкой роли имеют пунктир `#a9dc22`.

## Переменные окружения

Шаблон: `.env.example`. На сервере: `/opt/maxsport/.env`, права `600`. В git секретов нет.

| Переменная                | Смысл                                                  |
| ------------------------- | ------------------------------------------------------ |
| `PORT`                    | 3000                                                   |
| `PUBLIC_URL`              | `https://max-sport.sabirov.tech`                       |
| `BOT_USERNAME`            | `gov_max_sport_bot`                                    |
| `MAX_BOT_TOKEN`           | токен бота, сырая строка в Authorization, без `Bearer` |
| `WEBHOOK_SECRET`          | секрет webhook                                         |
| `DATABASE_URL`            | Postgres                                               |
| `POSTGRES_PASSWORD`       | пароль роли `maxsport`                                 |
| `REDIS_URL`               | Redis                                                  |
| `YANDEX_MAPS_JS_API_KEY`  | единственный ключ, который уходит в браузер            |
| `YANDEX_SUGGEST_API_KEY`  | только сервер                                          |
| `YANDEX_GEOCODER_API_KEY` | только сервер                                          |
| `YANDEX_STATIC_API_KEY`   | только сервер                                          |
| `IMAGE_TAG`               | `sha-<commit>` на проде, `local` локально              |
| `TELEGRAM_BOT_TOKEN`      | необязательный второй транспорт, не для питча          |

## Локальный запуск

```bash
npm install
cp .env.example .env
docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.dev.yml up --build
```

Без Docker (нужны свои Postgres и Redis):

```bash
npm run dev          # API :3000
npm run dev:app      # Mini App :5173, прокси /api
npm run migrate
npm run seed:demo    # после первого входа в Mini App
```

Проверки:

```bash
npm run check    # typecheck + boundaries + build + test
npm test
npm run build
```

## Прод

| Параметр | Значение                                            |
| -------- | --------------------------------------------------- |
| Хост     | Selectel, Ubuntu 24.04, 2 vCPU / 4 ГБ / 50 ГБ       |
| IPv4     | `135.106.186.253`                                   |
| SSH      | `deploy@135.106.186.253`, ключ `max_sport_selectel` |
| Firewall | 22, 80, 443                                         |
| Каталог  | `/opt/maxsport`                                     |
| DNS      | `max-sport.sabirov.tech` → этот IPv4                |

Контейнеры: `caddy`, `migrate` (один раз), `api`, `postgres`, `redis`. Postgres и Redis наружу не смотрят.

CI (`.github/workflows/ci.yml`): push в `main` или ручной запуск. Job `check` на каждый PR. Образ `ghcr.io/sabirovsr/maxsport:sha-<commit>` и `:latest` собирается и катится на VPS только с `main`. Секреты Actions: `SSH_HOST`, `SSH_USER`, `SSH_KEY`, `GHCR_USER`, `GHCR_TOKEN`.

Исходящий HTTPS к `platform-api2.max.ru` на голом Ubuntu часто падает без корневого сертификата Минцифры. Сертификаты лежат в `deploy/certs/` и ставятся в образ.

Webhook должен ответить `200` за 30 секунд. Подписка: `POST /subscriptions` → `https://max-sport.sabirov.tech/webhook`.
