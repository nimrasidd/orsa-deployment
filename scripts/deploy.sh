#!/usr/bin/env bash
# Run on Linux from repo root (e.g. ~/osra-app). Does not touch ~/orsa-solvency.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BRANCH="${DEPLOY_BRANCH:-main}"
COMPOSE="${COMPOSE:-docker compose}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

echo "==> Pull latest ($BRANCH) from origin"
git fetch origin
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

if [[ ! -f backend/.env.docker ]]; then
  echo "ERROR: backend/.env.docker is missing."
  echo "  cp ~/orsa-solvency/backend/.env.docker backend/.env.docker"
  echo "  # or: cp backend/.env.docker.example backend/.env.docker"
  exit 1
fi

echo "==> Rebuild and restart ($COMPOSE_FILE)"
$COMPOSE -f "$COMPOSE_FILE" build
$COMPOSE -f "$COMPOSE_FILE" up -d

echo "==> Status"
$COMPOSE -f "$COMPOSE_FILE" ps
echo "==> Done ($(pwd))"
