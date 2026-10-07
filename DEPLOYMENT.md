# Questify deployment guide

Questify is deployable as a small production/demo installation on one Linux
server. The production Compose stack runs Next.js, FastAPI, PostgreSQL,
persistent uploads/Chroma storage, and Caddy HTTPS. Redis and the placeholder
worker are intentionally omitted: the current world-generation implementation
runs as a resumable background job inside the single API process.

## 1. Create the server

For a zero-cost deployment, create an Oracle Cloud Always Free Ampere A1 VM
with Ubuntu, 2 OCPUs, 12 GB RAM, and enough boot storage for uploaded learning
materials. In both the Oracle security list and the VM firewall, allow:

- TCP 22 from your own IP for SSH.
- TCP 80 and TCP/UDP 443 from the internet.
- Do not expose ports 3000, 5432, or 8000.

Install Git, Docker Engine, and the Docker Compose plugin using Docker's
official Ubuntu instructions. Verify the installation:

```bash
docker --version
docker compose version
```

## 2. Configure DNS and secrets

Create an A record for your hostname pointing to the VM public IP. Clone the
repository and create the untracked production environment file:

```bash
git clone https://github.com/v4rshh/Questify.git
cd Questify
cp deploy/.env.example .env
```

Generate secrets:

```bash
# Hex avoids URL-escaping problems in the PostgreSQL connection string.
openssl rand -hex 32
openssl rand -base64 48
```

Edit `.env` and set all placeholders, especially `DOMAIN`, `WEB_ORIGIN`,
`POSTGRES_PASSWORD`, `SECRET_KEY`, and `LLM_API_KEY`. `WEB_ORIGIN` must exactly
match `https://DOMAIN`. Keep `NEXT_PUBLIC_API_URL=/api/v1` so browser requests
use the same HTTPS origin.

Never commit `.env`; it is already ignored by Git.

## 3. Start the production stack

```bash
docker compose -f docker-compose.prod.yml config --quiet
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f --tail=100
```

Caddy obtains and renews the TLS certificate automatically after DNS resolves
and ports 80/443 are reachable. Open `https://YOUR_DOMAIN` and verify:

```bash
curl https://YOUR_DOMAIN/health
```

## 4. Deploy updates

```bash
git pull --ff-only
docker compose -f docker-compose.prod.yml up -d --build
docker image prune -f
```

Named volumes survive container recreation. Do not run `docker compose down -v`
unless you intentionally want to delete the database, uploads, vectors, and TLS
state.

## 5. Back up persistent data

Create a directory readable only by the deployment user, then back up both the
database and the RAG/upload volume regularly:

```bash
mkdir -p backups
chmod 700 backups
docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
  > "backups/postgres-$(date +%F-%H%M).sql"
docker compose -f docker-compose.prod.yml exec -T api \
  tar -C /app/data -czf - . \
  > "backups/rag-data-$(date +%F-%H%M).tar.gz"
```

Copy backups away from the VM. A backup stored only on the same disk is not a
disaster-recovery backup.

## 6. Operational checks

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=200 api
docker compose -f docker-compose.prod.yml logs --tail=200 caddy
docker stats
df -h
```

## Current production scope

This setup is suitable for a portfolio, demonstration, or small controlled
group. Before treating it as a high-availability public service, add versioned
Alembic database migrations, off-server automated backups, monitoring/alerts,
email verification/password recovery, abuse/rate limiting, and external job
workers. Keep the API at one process until Chroma and world generation are
moved to shared external services.

## Validate with the example environment

This checks Compose syntax without reading or printing the real `.env` file:

```bash
QUESTIFY_ENV_FILE=deploy/.env.example \
  docker compose --env-file deploy/.env.example \
  -f docker-compose.prod.yml config --quiet
```
