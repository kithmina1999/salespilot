# Local Docker

This stack runs the full local SalesPilot app:

- backend API: <http://localhost:18080>
- tenant frontend: <http://localhost:13000>
- super-admin frontend: <http://localhost:13001>
- landing page: <http://localhost:13002>
- PostgreSQL: `127.0.0.1:15432`
- Redis: `127.0.0.1:16379`

## Start

The compose file includes safe local defaults, so this works without creating a
secret file:

```bash
docker compose -f docker-compose.local.yml up -d --build
```

If you need to change ports or seed a local account, create an ignored override
file:

```bash
cp .env.local.docker.example .env.local.docker
docker compose --env-file .env.local.docker -f docker-compose.local.yml up -d --build
```

On PowerShell:

```powershell
Copy-Item .env.local.docker.example .env.local.docker
docker compose --env-file .env.local.docker -f docker-compose.local.yml up -d --build
```

## Check

```bash
docker compose -f docker-compose.local.yml ps
curl -fsSL http://localhost:18080/health
```

Open:

- <http://localhost:13002> for the landing page
- <http://localhost:13000> for the tenant app
- <http://localhost:13001> for the admin app

## Stop

```bash
docker compose -f docker-compose.local.yml down
```

To reset local database, Redis, uploads, sessions, and private receipts:

```bash
docker compose -f docker-compose.local.yml down -v
```

## Notes

The backend runs with `GIN_MODE=debug` locally so HttpOnly auth cookies work over
plain HTTP. Production keeps `GIN_MODE=release` and terminates HTTPS at Nginx.

Local receipt uploads are stored in the `backend_private_uploads` Docker volume,
separate from public product uploads.
