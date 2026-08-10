#!/bin/sh
# Production deploy with automatic rollback if healthcheck fails.
# Does NOT touch Postgres data / does NOT force seed.
set -eu

APP_DIR="${APP_DIR:-/var/www/teklifbu}"
BRANCH="${DEPLOY_BRANCH:-main}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3010/api/theme}"
# compose project image for service "web"
IMAGE_LATEST="${IMAGE_LATEST:-teklifbu-web:latest}"
IMAGE_PREV="${IMAGE_PREV:-teklifbu-web:previous}"
WAIT_SECS="${WAIT_SECS:-180}"

cd "$APP_DIR"

echo "[deploy] $(date -u +%Y-%m-%dT%H:%M:%SZ) HEAD_before=$(git rev-parse --short HEAD 2>/dev/null || echo none)"

# 1) Remember currently running image (if any)
if docker image inspect "$IMAGE_LATEST" >/dev/null 2>&1; then
  docker tag "$IMAGE_LATEST" "$IMAGE_PREV"
  echo "[deploy] saved rollback image -> $IMAGE_PREV"
else
  echo "[deploy] no previous image yet (first deploy)"
fi

# 2) Pull code
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
sed -i 's/\r$//' scripts/deploy-vps.sh scripts/docker-entrypoint.sh 2>/dev/null || true
chmod +x scripts/deploy-vps.sh scripts/docker-entrypoint.sh 2>/dev/null || true

NEW_SHA="$(git rev-parse --short HEAD)"
echo "[deploy] code=$NEW_SHA $(git log -1 --pretty=%s)"

# 3) Build + start new
export DOCKER_BUILDKIT=1
docker compose build web
docker compose up -d
echo "[deploy] waiting health: $HEALTH_URL (max ${WAIT_SECS}s)"

# 4) Healthcheck
ok=0
elapsed=0
while [ "$elapsed" -lt "$WAIT_SECS" ]; do
  if wget -qO- "$HEALTH_URL" >/dev/null 2>&1 || curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    ok=1
    break
  fi
  # container crash-loop?
  status="$(docker inspect -f '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}' teklifbu-web 2>/dev/null || echo missing)"
  echo "[deploy] … ${elapsed}s status=[$status]"
  sleep 5
  elapsed=$((elapsed + 5))
done

if [ "$ok" = "1" ]; then
  echo "[deploy] HEALTHY — keep $NEW_SHA"
  docker compose ps
  exit 0
fi

# 5) Rollback
echo "[deploy] UNHEALTHY — rolling back to previous image"
if docker image inspect "$IMAGE_PREV" >/dev/null 2>&1; then
  docker tag "$IMAGE_PREV" "$IMAGE_LATEST"
  docker compose up -d web
  sleep 8
  if wget -qO- "$HEALTH_URL" >/dev/null 2>&1 || curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    echo "[deploy] ROLLBACK OK — site restored to previous build"
    docker compose ps
    exit 1
  fi
  echo "[deploy] ROLLBACK attempted but health still failing — check: docker compose logs web --tail 80"
  exit 1
fi

echo "[deploy] no previous image to restore — leaving failed deploy"
docker compose logs web --tail 60 || true
exit 1
