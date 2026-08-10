#!/bin/sh
set -eu

echo "[boot] waiting for postgres..."
i=0
until node -e "const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient(); p.\$connect().then(()=>p.\$disconnect()).then(()=>process.exit(0)).catch(()=>process.exit(1));" >/dev/null 2>&1
do
  i=$((i + 1))
  if [ "$i" -gt 90 ]; then
    echo "[boot] database not ready after 180s"
    exit 1
  fi
  sleep 2
done

user_count() {
  node -e "const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient(); p.user.count().then((c)=>{process.stdout.write(String(c)); return p.\$disconnect();}).catch(async ()=>{try{await p.\$disconnect()}catch{}; process.stdout.write('0');})" 2>/dev/null || echo 0
}

baseline_migrations() {
  echo "[boot] baselining migration history as applied..."
  for dir in /app/prisma/migrations/*/ /app/prisma/migrations/*; do
    [ -d "$dir" ] || continue
    name="$(basename "$dir")"
    case "$name" in
      migration_lock.toml|"") continue ;;
    esac
    npx prisma migrate resolve --applied "$name" >/dev/null 2>&1 || true
  done
}

bootstrap_schema() {
  echo "[boot] schema bootstrap via db push (skip broken migrate replay)"
  npx prisma db push --accept-data-loss --skip-generate
  baseline_migrations
}

echo "[boot] applying migrations..."
if ! npx prisma migrate deploy; then
  USERS="$(user_count)"
  echo "[boot] migrate deploy failed (users=${USERS})"
  # migrate reset broken SQL'i tekrar çalıştırıp sonsuz döngü yapıyordu — kullanma
  if [ "$USERS" = "0" ] || [ "${FORCE_SCHEMA_PUSH:-0}" = "1" ]; then
    bootstrap_schema
  else
    echo "[boot] fallback: db push --accept-data-loss"
    npx prisma db push --accept-data-loss --skip-generate
  fi
fi

NEED_SEED=0
if [ "${SEED_ON_BOOT:-auto}" = "1" ] || [ "${SEED_ON_BOOT:-auto}" = "true" ]; then
  NEED_SEED=1
elif [ "${SEED_ON_BOOT:-auto}" = "auto" ]; then
  COUNT="$(user_count)"
  if [ "$COUNT" = "0" ]; then
    NEED_SEED=1
  fi
fi

if [ "$NEED_SEED" = "1" ]; then
  echo "[boot] seeding..."
  npx tsx prisma/seed.ts || echo "[boot] seed warning (continuing)"
else
  echo "[boot] skip seed"
fi

echo "[boot] starting Next.js on :${PORT:-3010}"
exec npm run start
