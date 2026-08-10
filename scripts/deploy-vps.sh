#!/bin/sh
# VPS production deploy — DB'ye dokunmaz, seed zorlamaz
set -eu

APP_DIR="${APP_DIR:-/var/www/teklifbu}"
BRANCH="${DEPLOY_BRANCH:-main}"

cd "$APP_DIR"

echo "[deploy] $(date -u +%Y-%m-%dT%H:%M:%SZ) dir=$APP_DIR branch=$BRANCH"

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "[deploy] HEAD=$(git rev-parse --short HEAD) $(git log -1 --pretty=%s)"

export DOCKER_BUILDKIT=1
docker compose up -d --build

echo "[deploy] containers:"
docker compose ps

echo "[deploy] done"
