# SalesPilotLK

SalesPilotLK is an automated WhatsApp business management platform built for small and medium businesses that need to manage customer chats, products, carts, orders, payment proofs, and business operations from one dashboard.

This repository is a public project showcase for the SalesPilot v2 system. It highlights the product architecture, DevOps setup, deployment planning, and engineering work behind a production-oriented WhatsApp commerce platform.

## Project Highlights

- Multi-tenant WhatsApp commerce platform for merchants, customers, and system operators.
- Go backend for WhatsApp webhook processing, business APIs, order automation, rules, and payment workflows.
- Next.js merchant dashboard, admin dashboard, and public landing site.
- PostgreSQL and Redis based data layer for transactional records and shared runtime state.
- Docker Compose production stack with backend, frontend, admin, landing, PostgreSQL, Redis, Loki, Alloy, and Grafana.
- VPS deployment design using Nginx reverse proxy, Let's Encrypt SSL, systemd, health checks, and private service ports.
- Operational readiness work including encrypted database backups, restore documentation, log aggregation, rate limiting, and incident response runbooks.
- GitHub Actions workflows for Go tests, database migration checks, frontend builds, vulnerability scans, and production dependency audits.

## Why Go For The Backend?

The backend is built with Go because WhatsApp webhook systems need to acknowledge provider requests quickly while processing many independent customer conversations at the same time.

Go's lightweight goroutines, bounded worker pools, request timeouts, Redis-backed state, webhook deduplication, and per-customer locking make it a strong fit for high-concurrency message handling. This design helps the system process large message bursts reliably without blocking webhook responses or overloading server resources.

## Tech Stack

**Backend**

- Go
- Gin
- GORM
- PostgreSQL
- Redis
- JWT authentication
- WhatsApp Cloud API integration

**Frontend**

- Next.js
- React
- TypeScript
- Tailwind CSS
- SWR/Zustand
- Recharts

**DevOps & Infrastructure**

- Docker
- Docker Compose
- Nginx
- Let's Encrypt
- systemd
- GitHub Actions
- Grafana
- Loki
- Grafana Alloy
- Sentry-ready frontend configuration

## System Overview

SalesPilot is designed around a multi-tenant architecture. Each business owns its own products, customers, conversations, carts, orders, rules, usage records, and payment proofs.

High-level runtime components:

- `backend` - Go API, WhatsApp webhook handling, workers, scheduled jobs, and integrations.
- `frontend` - Merchant dashboard for daily business operations.
- `salespilot-admin-main` - System admin dashboard for platform operations.
- `landing` - Public website and legal pages.
- `postgres` - Main transactional database.
- `redis` - Shared pipeline state and runtime cache.
- `loki`, `alloy`, `grafana` - Log aggregation and operations visibility.

## Production Deployment Shape

The intended production target is a single Linux VPS:

- Public traffic reaches only Nginx on ports `80` and `443`.
- Nginx terminates HTTPS and routes traffic to internal app services.
- Application services are bound to localhost/private Docker networking.
- PostgreSQL and Redis are not publicly exposed.
- Logs are collected through Alloy and stored in Loki.
- Grafana is intended for operator access through a private route or SSH tunnel.
- Database backups are encrypted and can be copied to S3-compatible offsite storage.

## Repository Structure

```text
.
|-- backend/                 # Go API, WhatsApp pipeline, workers, handlers, tests
|-- frontend/                # Merchant dashboard
|-- salespilot-admin-main/   # Platform admin dashboard
|-- landing/                 # Public landing site
|-- deploy/                  # Nginx, systemd, backup, and observability configs
|-- docs/                    # Architecture, deployment, security, recovery, and runbooks
|-- docker-compose.prod.yml  # Production-oriented compose stack
|-- docker-compose.local.yml # Local development compose stack
```

## Documentation

Key project documents:

- `docs/architecture.md`
- `docs/nginx-ssl-vps-deployment.md`
- `docs/deployment-runbook.md`
- `docs/database-backups.md`
- `docs/disaster-recovery.md`
- `docs/log-aggregation.md`
- `docs/security-audit-owasp-top-10.md`
- `docs/load-testing.md`

## Security Note

Real environment files, credentials, API keys, tokens, database passwords, and production secrets are intentionally excluded from version control. Example environment files are included only as templates.

Before deploying any fork or copy of this project, create your own environment files, rotate all provider credentials, and review the deployment/security documentation.

## Author

**Kithmina Gunasinghe**  
DevOps Enthusiast and Software Engineering Undergraduate

- GitHub: [github.com/kithmina1999](https://github.com/kithmina1999)
- LinkedIn: [linkedin.com/in/kithmina-gunasinghe](https://www.linkedin.com/in/kithmina-gunasinghe)
