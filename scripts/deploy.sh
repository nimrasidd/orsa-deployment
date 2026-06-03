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

if ! docker network inspect "${SHARED_DOCKER_NETWORK:-orsa-solvency_default}" >/dev/null 2>&1; then
  echo "WARN: network ${SHARED_DOCKER_NETWORK:-orsa-solvency_default} not found."
  echo "  Start old stack first: cd ~/orsa-solvency && $COMPOSE up -d db backend"
  echo "  Or set SHARED_DOCKER_NETWORK to your compose project network (docker network ls)."
fi

echo "==> Rebuild and restart ($COMPOSE_FILE)"
$COMPOSE -f "$COMPOSE_FILE" build
$COMPOSE -f "$COMPOSE_FILE" up -d --build

echo "==> Status"
$COMPOSE -f "$COMPOSE_FILE" ps
echo "==> Done ($(pwd))"
