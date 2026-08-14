# Пошаговая настройка VPS и GitHub Actions

Исполняемая инструкция. Зачем так — [PRODUCTION.md](PRODUCTION.md). Этот файл — порядок команд.

---

## 0. PowerShell

Проверка входа:

```powershell
ssh -i $env:USERPROFILE\.ssh\max_sport_selectel deploy@135.106.186.253
```

Удобный хост — `%USERPROFILE%\.ssh\config`:

```
Host maxsport
  HostName 135.106.186.253
  User deploy
  IdentityFile ~/.ssh/max_sport_selectel
  IdentitiesOnly yes
```

Дальше: `ssh maxsport`. Все блоки «на сервере» — уже внутри этой сессии.

---

## 1. ОС: время, пакеты, swap, логи

На сервере:

```bash
sudo timedatectl set-timezone Europe/Moscow
timedatectl status

sudo apt-get update
sudo apt-get install -y unattended-upgrades fail2ban ufw curl ca-certificates gnupg
sudo dpkg-reconfigure -plow unattended-upgrades
```

Swap 2 ГБ (пропусти, если `swapon --show` уже что-то даёт):

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
swapon --show
```

Лимит journald:

```bash
sudo mkdir -p /etc/systemd/journald.conf.d
echo '[Journal]
SystemMaxUse=200M
MaxRetentionSec=14day' | sudo tee /etc/systemd/journald.conf.d/size.conf
sudo systemctl restart systemd-journald
```

---



## 2. SSH hardening

Сначала убедись, что вход **только ключом** уже работает (ты уже зашёл).

```bash
echo 'PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
AllowUsers deploy
PubkeyAuthentication yes
MaxAuthTries 3
X11Forwarding no' | sudo tee /etc/ssh/sshd_config.d/99-maxsport.conf

sudo sshd -t && sudo systemctl reload ssh
```

**Не закрывая это окно**, локально второе:

```powershell
ssh maxsport
```

Если второе окно вошло — первое можно не трогать. Если нет — в первом сеансе:

```bash
sudo rm /etc/ssh/sshd_config.d/99-maxsport.conf
sudo systemctl reload ssh
```

fail2ban:

```bash
sudo systemctl enable --now fail2ban
sudo fail2ban-client status sshd
```

---



## 3. UFW

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status verbose
```

В панели Selectel открой те же порты, если там есть firewall / security group.

---



## 4. Docker Engine + Compose

Официальный репозиторий Docker (не snap):

```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo usermod -aG docker deploy
```

Логи контейнеров:

```bash
echo '{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}' | sudo tee /etc/docker/daemon.json
sudo systemctl restart docker
```

Выйди из SSH и зайди снова, чтобы группа `docker` подхватилась:

```bash
docker version
docker compose version
```

`docker` без sudo у `deploy` = фактически root на хосте. Других пользователей в группу не добавляй.

---



## 5. Каталог приложения

```bash
sudo mkdir -p /opt/maxsport/backups
sudo chown -R deploy:deploy /opt/maxsport
chmod 755 /opt/maxsport
```

`.env` появится вместе с приложением:

```bash
# когда будут токены:
# nano /opt/maxsport/.env
# chmod 600 /opt/maxsport/.env
```

Пока нет `docker-compose.yml` в репо — каталог пустой, это нормально.

---



## 6. Ключ только для GitHub Actions

Локально (не класть личный `max_sport_selectel` в GitHub):

```powershell
ssh-keygen -t ed25519 -f $env:USERPROFILE\.ssh\deploy_gha -C "gha-maxsport" -N '""'
Get-Content $env:USERPROFILE\.ssh\deploy_gha.pub
```

Публичную строку добавь на сервер:

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo 'СЮДА_ВСТАВИТЬ_СОДЕРЖИМОЕ_deploy_gha.pub' >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Проверка локально:

```powershell
ssh -i $env:USERPROFILE\.ssh\deploy_gha -o IdentitiesOnly=yes deploy@135.106.186.253 "echo gha-key-ok"
```

Host key для Actions (локально) — опционально, если понадобится raw SSH вне `appleboy/ssh-action`:

```powershell
ssh-keyscan -t ed25519,rsa 135.106.186.253
```

---



## 7. Секреты GitHub

Полная таблица и чеклист первого deploy: [deploy/GITHUB_SECRETS.md](../../deploy/GITHUB_SECRETS.md).

Репозиторий → Settings → Secrets and variables → Actions.


| Secret               | Откуда                                                                                        |
| -------------------- | --------------------------------------------------------------------------------------------- |
| `SSH_HOST`           | `135.106.186.253`                                                                             |
| `SSH_USER`           | `deploy`                                                                                      |
| `SSH_KEY`            | содержимое файла `deploy_gha` **без** `.pub` (приватный ключ, только для Actions)             |
| `GHCR_USER`          | `sabirovsr` (GitHub username в нижнем регистре)                                               |
| `GHCR_TOKEN`         | PAT с `read:packages` (classic или fine-grained, permission **Packages: Read**)               |
| `SSH_PORT`           | `22` — опционально, если SSH не на стандартном порту                                          |
| `TELEGRAM_BOT_TOKEN` | опционально — уведомления CI/CD                                                               |
| `TELEGRAM_CHAT_ID`   | опционально — куда слать уведомления                                                          |


`GITHUB_TOKEN` для push в GHCR выдаётся самим Actions — отдельный секрет не нужен.

Токен бота MAX в GitHub **не клади**. Он только в `/opt/maxsport/.env`.

Packages: после первого push образа в GHCR поставь пакет **private**.

---



## 8. Workflow (когда будет Dockerfile)

Пока образа нет, файл можно заготовить, но job будет падать на `docker build`. Класть в `.github/workflows/deploy.yml`.

Перед коммитом **замени теги на SHA**:

```powershell
gh api repos/actions/checkout/commits/v4 --jq .sha
gh api repos/docker/setup-buildx-action/commits/v3 --jq .sha
gh api repos/docker/login-action/commits/v3 --jq .sha
gh api repos/docker/build-push-action/commits/v6 --jq .sha
```

Шаблон (подставь SHA в `uses:` и owner/repo):

```yaml
name: build-and-deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions: {}

concurrency:
  group: production
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    outputs:
      image: ${{ steps.meta.outputs.image }}
    steps:
      - uses: actions/checkout@<SHA> # v4
      - uses: docker/setup-buildx-action@<SHA> # v3
      - uses: docker/login-action@<SHA> # v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - id: meta
        run: |
          IMAGE="ghcr.io/${{ github.repository_owner }}/maxsport:${{ github.sha }}"
          echo "image=$IMAGE" >> "$GITHUB_OUTPUT"
      - uses: docker/build-push-action@<SHA> # v6
        with:
          context: .
          push: true
          tags: |
            ghcr.io/${{ github.repository_owner }}/maxsport:${{ github.sha }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - name: SSH known_hosts
        run: |
          mkdir -p ~/.ssh
          chmod 700 ~/.ssh
          echo "${{ secrets.DEPLOY_KNOWN_HOSTS }}" > ~/.ssh/known_hosts
          chmod 644 ~/.ssh/known_hosts
      - name: Install SSH key
        run: |
          echo "${{ secrets.DEPLOY_SSH_KEY }}" > ~/.ssh/deploy_key
          chmod 600 ~/.ssh/deploy_key
      - name: Pull and up
        env:
          IMAGE: ${{ needs.build.outputs.image }}
        run: |
          ssh -i ~/.ssh/deploy_key -o IdentitiesOnly=yes \
            "${{ secrets.DEPLOY_USER }}@${{ secrets.DEPLOY_HOST }}" \
            "set -euo pipefail
             echo '${{ secrets.GHCR_PULL_TOKEN }}' | docker login ghcr.io -u '${{ github.repository_owner }}' --password-stdin
             cd /opt/maxsport
             export IMAGE_TAG='${{ github.sha }}'
             docker compose pull
             docker compose up -d
            "
```

`StrictHostKeyChecking=no` не используем: host key уже в `DEPLOY_KNOWN_HOSTS`.

Откат на сервере:

```bash
cd /opt/maxsport
export IMAGE_TAG=<предыдущий_полный_sha>
docker compose pull && docker compose up -d
```

Cron бэкапа Postgres — когда контейнер `postgres` появится:

```bash
mkdir -p /opt/maxsport/backups
crontab -e
# 0 3 * * * docker compose -f /opt/maxsport/docker-compose.yml exec -T postgres pg_dump -U maxsport maxsport | gzip > /opt/maxsport/backups/$(date +\%F).sql.gz
```

---



## 9. DNS

A-запись: `max-sport.sabirov.tech` → `135.106.186.253`.

Проверка с ноутбука:

```powershell
nslookup max-sport.sabirov.tech
```

Let's Encrypt Caddy выпустит, когда поднимем compose и имя уже резолвится сюда.

---



## 10. Проверка, что база готова

На сервере:

```bash
sudo ufw status
sudo fail2ban-client status sshd
swapon --show
docker version
ls -ld /opt/maxsport
sshd -T | grep -E 'passwordauthentication|permitrootlogin|allowusers'
```

Локально (закрытые порты БД — ожидаем timeout/filtered, не open):

```powershell
Test-NetConnection 135.106.186.253 -Port 22
Test-NetConnection 135.106.186.253 -Port 443
Test-NetConnection 135.106.186.253 -Port 5432
```

Готово к приложению, когда §12 в [PRODUCTION.md](PRODUCTION.md) отмечен. Workflow включай после Dockerfile в репо.