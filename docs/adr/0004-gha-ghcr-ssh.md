# Доставка: GitHub Actions + GHCR + SSH

---
status: accepted
---

Прод — одна VPS Selectel. Собираем образ на **GitHub-hosted runner**, кладём в **private GHCR**, на сервер заходим по SSH пользователем `deploy` и делаем `docker compose pull && up`. Сборку на 2 vCPU и self-hosted runner на этой же машине не используем.

## Considered Options

1. **Self-hosted runner на VPS** — экономит минуты, но даёт runner права на репозиторий и ест CPU рядом с Postgres. Лишний blast radius.
2. **Сборка `docker compose build` на сервере по rsync** — дешёво, но 2 vCPU заняты сборкой, кэш слоёв грязный, откат к SHA сложнее.
3. **GitHub-hosted + GHCR + SSH (выбрано)** — сборка вне прода, тег образа = git SHA, откат = предыдущий SHA, секреты приложения на диск VPS не попадают в образ.

## Consequences

- На VPS нужен только pull (токен `read:packages` на время деплоя).
- `GITHUB_TOKEN` с `packages: write` — только job сборки.
- Отдельный SSH-ключ для Actions, не личный `max_sport_selectel`.
- Workflow YAML пишем позже; контракт jobs/permissions — в [PRODUCTION.md](../ops/PRODUCTION.md).
