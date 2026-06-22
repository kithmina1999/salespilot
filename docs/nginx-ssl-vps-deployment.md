# Nginx + Let's Encrypt VPS Deployment

This is the final VPS shape for SalesPilot:

- `salespilot.lk` -> landing service on `127.0.0.1:3002`
- `app.salespilot.lk` -> tenant app on `127.0.0.1:3000`
- `admin.salespilot.lk` -> system admin app on `127.0.0.1:3001`
- `api.salespilot.lk` -> Go API on `127.0.0.1:8080`

Docker Compose keeps the raw app ports private by binding them to localhost.
Nginx runs on the VPS host, terminates HTTPS, and proxies to those localhost ports.

## Change Later

Update these after buying the VPS:

- `CHANGE_ME_VPS_IPV4`: DNS `A` records for `salespilot.lk`, `www.salespilot.lk`, `app.salespilot.lk`, `admin.salespilot.lk`, `api.salespilot.lk`
- `CHANGE_ME_EMAIL`: email used for Let's Encrypt renewal notices
- `CHANGE_ME_DEPLOY_DIR`: systemd assumes the repo lives at `/opt/salespilot-v2`
- `CHANGE_ME_BACKUP_MOUNT`: database backups assume a mounted backup volume at `/mnt/salespilot-backups`
- Domain names if we do not use `salespilot.lk`
- Ports in `deploy/nginx/salespilot.ssl.conf` if `docker-compose.prod.yml` port bindings change
- Certificate path if Certbot creates `/etc/letsencrypt/live/salespilot.lk-0001/`
- `.env.production` values:
  - `SERVER_URL=https://api.salespilot.lk`
  - `FRONTEND_URL=https://app.salespilot.lk,https://admin.salespilot.lk`
  - `NEXT_PUBLIC_SITE_URL=https://salespilot.lk`
  - `NEXT_PUBLIC_APP_URL=https://app.salespilot.lk`
  - `NEXT_APPLICATION_URL=https://app.salespilot.lk`

Do not create `AAAA` DNS records unless the VPS has working IPv6.

## VPS Setup Commands

These commands assume Ubuntu 22.04/24.04 LTS.

```bash
sudo apt update
sudo apt install -y nginx certbot gnupg awscli curl
sudo mkdir -p /var/www/letsencrypt
```

Open firewall ports:

```bash
sudo ufw allow OpenSSH
sudo ufw allow "Nginx Full"
sudo ufw --force enable
sudo ufw status
```

Install the systemd service after the repo and `.env.production` are in place:

```bash
sudo cp deploy/systemd/salespilot.service /etc/systemd/system/salespilot.service
sudo install -d -m 700 /etc/salespilot
sudo cp deploy/deploy.env.example /etc/salespilot/deploy.env
sudo chmod 600 /etc/salespilot/deploy.env
sudo chmod +x deploy/scripts/deploy-production.sh
sudo systemctl daemon-reload
sudo systemctl enable salespilot
sudo systemctl start salespilot
sudo systemctl status salespilot
```

Use these after later deploys:

```bash
sudo /bin/bash deploy/scripts/deploy-production.sh
sudo systemctl restart salespilot
journalctl -u salespilot -f
```

Install the bootstrap config:

```bash
sudo cp deploy/nginx/salespilot.bootstrap.conf /etc/nginx/sites-available/salespilot
sudo ln -sf /etc/nginx/sites-available/salespilot /etc/nginx/sites-enabled/salespilot
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Issue the certificate:

```bash
sudo certbot certonly --webroot \
  -w /var/www/letsencrypt \
  --email CHANGE_ME_EMAIL \
  --agree-tos \
  --no-eff-email \
  -d salespilot.lk \
  -d www.salespilot.lk \
  -d app.salespilot.lk \
  -d admin.salespilot.lk \
  -d api.salespilot.lk
```

Install the SSL proxy config:

```bash
sudo cp deploy/nginx/salespilot-ssl-params.conf /etc/nginx/snippets/salespilot-ssl-params.conf
sudo cp deploy/nginx/salespilot-security-headers.conf /etc/nginx/snippets/salespilot-security-headers.conf
sudo cp deploy/nginx/salespilot.ssl.conf /etc/nginx/sites-available/salespilot
sudo nginx -t
sudo systemctl reload nginx
```

Verify renewal:

```bash
sudo certbot renew --dry-run
systemctl list-timers | grep certbot
```

Set up database backups:

```bash
sudo install -d -m 700 /etc/salespilot
openssl rand -base64 48 | sudo tee /etc/salespilot/backup-passphrase >/dev/null
sudo chmod 600 /etc/salespilot/backup-passphrase
sudo cp deploy/backups/salespilot-backup.env.example /etc/salespilot/backup.env
sudo chmod 600 /etc/salespilot/backup.env
sudo cp deploy/systemd/salespilot-db-backup.service /etc/systemd/system/salespilot-db-backup.service
sudo cp deploy/systemd/salespilot-db-backup.timer /etc/systemd/system/salespilot-db-backup.timer
sudo systemctl daemon-reload
sudo systemctl enable --now salespilot-db-backup.timer
```

See `docs/database-backups.md` for offsite R2/S3 settings and restore steps.

## Deploy Order

1. Point DNS records to `CHANGE_ME_VPS_IPV4`.
2. Install Docker and Docker Compose plugin.
3. Place the repo at `/opt/salespilot-v2` or update `deploy/systemd/salespilot.service`.
4. Create `.env.production` from `.env.production.example`.
   See `docs/production-env.md` for every variable.
5. Mount the local backup volume at `/mnt/salespilot-backups`.
6. Start the app with systemd:

```bash
sudo systemctl start salespilot
cd /opt/salespilot-v2
docker compose -f docker-compose.prod.yml ps
```

7. Install Nginx bootstrap config.
8. Issue the Let's Encrypt certificate.
9. Install Nginx SSL config.
10. Install and test database backups.
11. Run a checked deploy:

```bash
sudo /bin/bash deploy/scripts/deploy-production.sh
```

12. Test:

```bash
curl -I https://salespilot.lk
curl -I https://app.salespilot.lk
curl -I https://admin.salespilot.lk
curl -I https://api.salespilot.lk/health
```

## Production Notes

- Keep Docker app ports bound to `127.0.0.1`; only Nginx should expose public HTTP/HTTPS.
- Meta WhatsApp webhook URL should be `https://api.salespilot.lk/api/whatsapp/webhook`.
- If using Cloudflare proxy, set SSL mode to `Full (strict)` after certificates are installed.
- The Nginx config allows uploads up to `20m`; increase `client_max_body_size` only if product or proof uploads need more.
- Security headers are installed from `deploy/nginx/salespilot-security-headers.conf`.
  CSP is intentionally not enforced yet; add `Content-Security-Policy-Report-Only`
  first and test Sentry, Cloudinary, Google Fonts, API calls, and payment redirects before enforcing it.
