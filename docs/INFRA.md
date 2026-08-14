# Инфраструктура и домен

Карта адресов и TLS. Как должна быть настроена машина и CI — [ops/PRODUCTION.md](ops/PRODUCTION.md). Доставка: [ADR 0004](adr/0004-gha-ghcr-ssh.md).

## Публичный адрес

**Mini App и сайт бота:** `https://max-sport.sabirov.tech`

Это URL, который в кабинете MAX вставляется в поле мини-приложения (HTTPS, ≤1024 символа). С этого же хоста позже отдаём лендинг и само Mini App.

Планируемая карта путей (не реализовано):

| URL | Назначение |
| --- | --- |
| `https://max-sport.sabirov.tech/` | Лендинг / витрина бота |
| `https://max-sport.sabirov.tech/app` | Mini App (WebView MAX) |
| `https://max-sport.sabirov.tech/webhook` | HTTPS webhook бота, только порт 443 |
| `https://max-sport.sabirov.tech/healthz` | Проверка, что процесс жив |

Диплинк Mini App: `https://max.ru/<bot>?startapp=...` — это не наш домен, это вход MAX. Payload ведёт на экран внутри приложения, которое загружено с `max-sport.sabirov.tech`.

## Сервер

| Параметр | Значение |
| --- | --- |
| Хостер | Selectel, 2 vCPU / 4 ГБ / 50 ГБ NVMe |
| ОС | Ubuntu 24.04 LTS |
| IPv4 | `135.106.186.253` |
| SSH | `deploy@135.106.186.253` (ключ локально: `max_sport_selectel`) |
| Firewall | только `22`, `80`, `443` |

На одной машине: Caddy (TLS) → Fastify, PostgreSQL+PostGIS, Redis. Postgres и Redis наружу не публикуем.

A-запись: `max-sport.sabirov.tech` → `135.106.186.253`.

## TLS — две разные задачи

1. **MAX стучится к нам** (webhook, открытие Mini App). Нужен сертификат доверенного УЦ на `max-sport.sabirov.tech`. Let's Encrypt подходит. Самоподписанные MAX не принимает. Только порт 443, порт в URL не указывают.
2. **Мы стучимся в MAX** (`platform-api2.max.ru`). Цепочка часто на корне Минцифры. На голом Ubuntu/Docker без российского CA исходящие HTTPS-вызовы падают. Это нужно учесть при деплое, не при продуктовой логике.

## Канал событий: Webhook, не Long Polling

С первого дня только Webhook. Long Polling не подключаем. Решение: [ADR 0002](adr/0002-webhook-not-long-polling.md).

Webhook: ответ `200` за 30 секунд. Если endpoint молчит 8 часов, MAX **сам отписывается**. Подписку надо вешать при старте процесса и держать процесс живым.

Секрет webhook (`X-Max-Bot-Api-Secret`) — обязателен в плане, даже если поле API опционально.

## Секреты

Токен бота — только `/opt/maxsport/.env` на сервере, не в git и не в Mini App. В Authorization — сырая строка, без `Bearer`. Список переменных и секреты CI — в [PRODUCTION.md](ops/PRODUCTION.md) §8–9.
