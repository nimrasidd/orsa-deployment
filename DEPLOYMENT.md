# Git-based deployment

Push from your **Windows dev machine** → pull on a **new Linux folder**.  
Leave the old tar deployment (`~/orsa-solvency`) running as-is.

| Location | Role |
|----------|------|
| Windows: `osra ui` | Develop, commit, `git push` |
| GitHub: `nimrasidd/orsa-deployment` | `main` branch |
| Linux: `~/osra-app` | **New** git clone — `git pull` + Docker here |
| Linux: `~/orsa-solvency` | **Old** tar deploy — do not change |

---

## Part 1 — This project (Windows) → GitHub

Remote is already configured:

```text
origin  https://github.com/nimrasidd/orsa-deployment.git
branch  main
```

### Every time you change code locally

```powershell
cd "D:\OneDrive - SIR Consultants (Pvt.) Ltd\osra\osra ui"

git add -A
git status
# Confirm: no .env, no __pycache__, no *.db / *.dump / *.tar

git commit -m "Short description of your change"
git push origin main
```

### First-time push (if GitHub is behind your PC)

Same commands as above. GitHub must have your latest code before the server can pull it.

---

## Docker Compose files

| File | Use |
|------|-----|
| `docker-compose.yml` | **Local dev** — Vite dev server, debug log mount, Postgres on host port 5432 |
| `docker-compose.prod.yml` | **Linux server** — **5174** / **8001** + Postgres (`db`, volume `solvency_pg_data`, not exposed on host) |

`scripts/deploy.sh` uses **`docker-compose.prod.yml`** by default on the server.

---

## Part 2 — New Linux deployment (git clone)

Use a **different folder** from the old one so nothing in `~/orsa-solvency` is modified.

### One-time setup on `tm42`

```bash
# 1) Clone into NEW directory
cd ~
git clone https://github.com/nimrasidd/orsa-deployment.git osra-app
cd ~/osra-app
git checkout main

# 2) Server env (not in git) — copy from old deploy OR use template
cp ~/orsa-solvency/backend/.env.docker backend/.env.docker
# OR:
# cp backend/.env.docker.example backend/.env.docker
# nano backend/.env.docker   # CORS_ORIGINS=http://YOUR_IP:5174

# 3) Start (fixed ports 5174 / 8001 — old deploy can keep 5173 / 8000)
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

### Git auth on the server (once)

```bash
cd ~/osra-app
git pull origin main
# Use GitHub username + Personal Access Token (HTTPS)
```

Or SSH (recommended):

```bash
ssh-keygen -t ed25519 -f ~/.ssh/osra_deploy -N ""
cat ~/.ssh/osra_deploy.pub
# GitHub → repo → Settings → Deploy keys → Add (read-only OK)

cd ~/osra-app
git remote set-url origin git@github.com:nimrasidd/orsa-deployment.git
```

### Database

Prod compose starts its own `db` service (volume `solvency_pg_data`). After a one-time `pg_restore`, keep using this stack only.

```env
DATABASE_URL=postgresql://postgres:abc123@db:5432/orsa_db
```

Schema seed (if empty DB): `supabase/ORSA_new_init.sql` — not `all_in_one.sql`.

---

## Part 3 — Day-to-day (local → server)

**Windows:**

```powershell
git push origin main
```

**Linux (`~/osra-app` only):**

```bash
cd ~/osra-app
./scripts/deploy.sh
```

That script runs `git pull` and `docker compose -f docker-compose.prod.yml up -d --build`.

---

## Ports checklist (old + new both running)

| Service | Old `~/orsa-solvency` | New `~/osra-app` (if both up) |
|---------|------------------------|-------------------------------|
| Frontend | 5173 | **5174** (fixed in prod compose) |
| Backend | 8000 | **8001** (fixed in prod compose) |
| Postgres | 5432 (often exposed) | internal only (`db` in prod compose) |

Open new app: `http://SERVER:5174`. Set `CORS_ORIGINS` in `backend/.env.docker` to match.

---

## Troubleshooting

| Issue | Fix |
|--------|-----|
| `git pull` fails auth | PAT or SSH deploy key |
| `backend/.env.docker` missing | `cp` from `~/orsa-solvency` or `.env.docker.example` |
| Port already allocated | Stop old stack or change hardcoded ports in `docker-compose.prod.yml` |
| API 404 from browser | Prod uses nginx proxy; use `docker-compose.prod.yml`, not dev compose |
