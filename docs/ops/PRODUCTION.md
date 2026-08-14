# Прод-ранбук MAX Sport

Исполняемая инструкция с командами: [SETUP.md](SETUP.md). Зачем так — этот файл.

Решение о доставке: [ADR 0004](../adr/0004-gha-ghcr-ssh.md). Стек приложения: [STACK.md](../STACK.md). Домен и webhook: [INFRA.md](../INFRA.md).

## 1. Инвентарь


| Параметр           | Значение                                                                 |
| ------------------ | ------------------------------------------------------------------------ |
| Роль               | Единственный prod                                                        |
| Хостер             | Selectel                                                                 |
| Ожидаемый размер   | 2 vCPU / 4 ГБ RAM / 50 ГБ NVMe                                           |
| ОС                 | Ubuntu 24.04 LTS                                                         |
| IPv4               | `135.106.186.253`                                                        |
| DNS                | `max-sport.sabirov.tech` → этот IPv4 (A)                                 |
| SSH user           | `deploy`                                                                 |
| Локальный вход     | `ssh -i $env:USERPROFILE\.ssh\max_sport_selectel deploy@135.106.186.253` |
| Каталог приложения | `/opt/maxsport`                                                          |


Ключ `max_sport_selectel` живёт только на рабочей машине, не в git и не в образе. Для GitHub Actions — **отдельная** пара ключей (см. §8).

Публичные порты: `22`, `80`, `443`. Postgres и Redis снаружи не слушают.

## 2. База ОС

Цель: предсказуемые часы, патчи, запас RAM, чтобы логи не съели диск.

- Часовой пояс: `Europe/Moscow` (или тот, что зафиксируем для слотов Лобби — один на всю систему).
- NTP: `timedatectl` / `systemd-timesyncd` включён. Для окна Явки `[T−20; T+15]` рассинхрон часов недопустим.
- `unattended-upgrades` для security updates. Ребут по необходимости — руками в окно, не в середине демо (MAX снимет webhook после 8 часов молчания, но короткий reboot ок, если процесс сразу встанет).
- Swap: **1–2 ГБ** на 4 ГБ RAM, чтобы пик Postgres+Node не убил OOM без следа. Не замена RAM.
- `journald`: лимит размера (например `SystemMaxUse=200M`), persistent.
- Пакеты минимума: `ufw`, `fail2ban`, `docker.io` или Docker CE, Compose plugin, `curl`, `ca-certificates`.

Пример (спека, не выполнять):

```bash
sudo timedatectl set-timezone Europe/Moscow
sudo apt-get update
sudo apt-get install -y unattended-upgrades fail2ban ufw
sudo dpkg-reconfigure -plow unattended-upgrades
```

Swap:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

В `/etc/fstab`: `/swapfile none swap sw 0 0`.

## 3. SSH

Уже есть пользователь `deploy` и вход по ключу. Не меняем порт 22 без нужды — сломаем текущий доступ.

Целевые настройки `sshd`:

- `PasswordAuthentication no`
- `KbdInteractiveAuthentication no`
- `PermitRootLogin no`
- `AllowUsers deploy`
- `PubkeyAuthentication yes`
- `MaxAuthTries 3`
- `X11Forwarding no`

Клиент:

```
Host maxsport
  HostName 135.106.186.253
  User deploy
  IdentityFile ~/.ssh/max_sport_selectel
  IdentitiesOnly yes
```

`fail2ban` jail `sshd` включён.

Отдельный ключ **только для Actions** (`deploy_gha`): в `~deploy/.ssh/authorized_keys` вторая строка. Личный ключ локальный в секреты GitHub не кладём.

Проверка после hardening: новый SSH-сеанс **до** закрытия старого. Иначе можно выкинуть себя с машины.

## 4. Сеть

UFW:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

В панели Selectel (security group / firewall) — те же порты, если фильтр есть на уровне облака. Не полагаться только на UFW.

Исходящий HTTPS к `platform-api2.max.ru` должен проходить. Российский CA Минцифры — в образе приложения или в системном store (см. [INFRA.md](../INFRA.md) § TLS).

IPv6: либо настроить AAAA и слушать 443, либо явно не анонсировать. Смешанный «AAAA есть, сервис только на v4» ломает часть клиентов.

## 5. Docker

- Docker Engine + Compose v2 plugin.
- Пользователь `deploy` в группе `docker`. Это **эквивалент root** на хосте. Фиксируем: только `deploy`, отдельный ключ GHA, никаких лишних людей в группе.
- Логи контейнеров: `json-file`, `max-size=10m`, `max-file=3` (в `daemon.json` или в compose `logging`).
- Сеть: bridge compose, **без** `ports:` у `postgres` и `redis`. Только `expose` внутри сети. Caddy публикует `80` и `443`.
- Restart: `unless-stopped` у всех сервисов. Webhook MAX живёт, пока процесс отвечает `200`.
- Healthcheck у api, postgres, redis. Caddy зависит от healthy api, когда api уже есть.

`deploy` не раздуваем sudoers «на всё». Достаточно docker + запись в `/opt/maxsport`.

## 6. Каталог `/opt/maxsport`

```
/opt/maxsport/
  docker-compose.yml      # в git, на сервере актуальная копия из репо или только compose-фрагмент prod
  .env                    # НЕ в git, chmod 600, owner deploy
  backups/                # дампы Postgres
```

Владелец: `deploy:deploy`. `.env` не монтируется в образ на этапе build — только `env_file` в runtime.

Состав compose (когда появится код): `caddy`, `api` (Fastify + webhook), `postgres` (PostGIS), `redis`. Образ api — из GHCR, не `build:` на сервере в проде.

## 7. GHCR

- Реестр: `ghcr.io/<github-owner>/maxsport` (owner появится, когда репозиторий будет на GitHub).
- Visibility: **private**.
- Тег: полный git SHA (`ghcr.io/<owner>/maxsport:<sha>`), дополнительно `:<sha7>` удобства ради. `latest` не использовать как единственный тег отката.
- Job сборки пушит SHA. Job деплоя на VPS выставляет `IMAGE_TAG=<sha>` в окружении compose.
- Retention: в настройках Packages удалять нетегированные / старше N — чтобы не раздувать GHCR. Не удалять SHA, который сейчас на проде.

Откат: `IMAGE_TAG=<предыдущий_sha> docker compose pull && docker compose up -d`.

## 8. GitHub Actions — контракт (YAML позже)

Два job, GitHub-hosted runner.

**build**

- Trigger: `push` в `main` (или ручной `workflow_dispatch`). Не секреты на `pull_request` из форков.
- `permissions`: `contents: read`, `packages: write`. Остальное `{}` на уровне workflow.
- Actions **пинить по полному SHA коммита**, не `@v4`.
- Login в GHCR через `GITHUB_TOKEN`.
- `docker build` / `buildx`, push `<sha>`.

**deploy** (`needs: build`)

- `permissions`: `contents: read` (без `packages: write`).
- Секреты:
  - `DEPLOY_SSH_KEY` — приватный ключ `deploy_gha`, не личный локальный.
  - `DEPLOY_HOST` — `135.106.186.253` (или DNS, если SSH по имени стабилен).
  - `DEPLOY_KNOWN_HOSTS` — строка `ssh-keyscan` / известный host key. **Не** `StrictHostKeyChecking=no`.
  - `GHCR_PULL_TOKEN` — fine-grained или classic PAT с `read:packages` (или `GITHUB_TOKEN` не подойдёт на чужой машине после job). Логин на VPS в том же шаге: `echo token | docker login ghcr.io -u <user> --password-stdin`. Не оставлять токен в `~/.docker/config.json` с правами на запись всем; `600`.
- По SSH: `cd /opt/maxsport && IMAGE_TAG=... docker compose pull && docker compose up -d`.
- После up (с хоста):
  - `docker compose exec api wget -qO- http://127.0.0.1:3000/healthz` — api внутри сети compose
  - `curl -fsS https://max-sport.sabirov.tech/healthz` — HTTPS; после рестарта Caddy может занять 30–60 с
  - `docker compose logs api | grep -i webhook` — ожидается `Webhook subscription registered`

Environment GitHub `production`: опционально required reviewer. Для хакатона можно без, но секреты всё равно только в Environment/Repository secrets, не в логах.

Запрещено:

- Печатать `MAX_BOT_TOKEN`, SSH-ключ, PAT.
- Деплой с ветки фичи напрямую в этот хост.
- Self-hosted runner на этой VPS.



## 9. Секреты приложения

На сервере в `/opt/maxsport/.env` (не в GHCR):


| Переменная          | Зачем                                          |
| ------------------- | ---------------------------------------------- |
| `MAX_BOT_TOKEN`     | Authorization к MAX, без `Bearer`              |
| `WEBHOOK_SECRET`    | `X-Max-Bot-Api-Secret`, `[A-Za-z0-9_-]{5,256}` |
| `TELEGRAM_BOT_TOKEN` | второй транспорт, опционально; не для питча  |
| `POSTGRES_PASSWORD` | только внутренняя сеть                         |
| `DATABASE_URL`      | api → postgres                                 |
| `REDIS_URL`         | api → redis                                    |


GitHub Secrets для пайплайна — §8. Токен бота в Actions **не нужен**, пока job не вызывает MAX API (подписка webhook — при старте контейнера api, токен из `.env`).

Ротация: новый токен в кабинете MAX → правка `.env` → `docker compose up -d` api. Старый отозвать. Webhook secret — вместе с переподпиской `POST /subscriptions`.

Образ не содержит `.env`. Mini App не видит токен.

## 10. Бэкапы

- Postgres: `pg_dump` в `/opt/maxsport/backups/YYYY-MM-DD.sql.gz`, cron пользователя `deploy` раз в сутки. Хранить ≥7 дней на диске. 50 ГБ хватает, если не копить бесконечно.
- Redis: не бэкапим как источник истины (Pub/Sub / кэш).
- `.env` бэкапить отдельно в менеджер паролей команды, не в тот же публичный диск без шифрования.
- Восстановление прогонять хотя бы один раз на копии, иначе dump бесполезен.



## 11. Наблюдаемость (минимум)

- `GET https://max-sport.sabirov.tech/healthz` — liveness api за Caddy.
- `docker compose -f /opt/maxsport/docker-compose.yml ps` и `logs --tail=200`.
- Диск: `df -h` (сертификаты Caddy, dump, логи).
- Алерты «из космоса» не обязательны на хакатон. Обязательно: после деплоя глазами healthz и что webhook не отвалился (бот отвечает в MAX).

Простой: если api лежит > нескольких минут — поднять. Если лежал часы — заново `POST /subscriptions` (контейнер должен делать это на старте).

## 12. Чеклист приёмки машины (до приложения)

- [ ] SSH с локальным ключом `max_sport_selectel`, root по паролю нельзя.
- [ ] Второй сеанс SSH после правок sshd.
- [ ] `ufw status`: только 22/80/443.
- [ ] Снаружи nmap/проверка: 5432 и 6379 закрыты.
- [ ] fail2ban активен.
- [ ] unattended-upgrades включён.
- [ ] Swap есть, `swapon --show`.
- [ ] Docker работает от `deploy` без sudo (осознаём риск).
- [ ] `/opt/maxsport` принадлежит `deploy`, `.env` ещё нет или `600`.
- [ ] A-запись `max-sport.sabirov.tech` → `135.106.186.253`.
- [ ] В Selectel firewall совпадает с UFW.
- [ ] Host key сервера сохранён для GHA (`DEPLOY_KNOWN_HOSTS`).
- [ ] Личный ключ не залит в GitHub Secrets; залит только `deploy_gha`.

Когда появится стек: TLS Let's Encrypt, healthz 200, `/webhook` с секретом, бот `/start`, Postgres не в интернете.