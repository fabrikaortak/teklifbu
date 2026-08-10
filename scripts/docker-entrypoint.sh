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
  node -e "const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient(); p.user.count().then((c)=>{process.stdout.write(String(c)); return p.\$disconnect();}).catch(async ()=>{try{await p.\$disconnect()}catch{}; process.stdout.write('0');})"
}

echo "[boot] applying migrations..."
if ! npx prisma migrate deploy; then
  USERS="$(user_count || echo 0)"
  echo "[boot] migrate deploy failed (users=${USERS})"
  if [ "$USERS" = "0" ]; then
    echo "[boot] empty DB — reset schema and re-apply all migrations"
    npx prisma migrate reset --force
  else
    echo "[boot] fallback: db push --accept-data-loss"
    npx prisma db push --accept-data-loss
  fi
fi

NEED_SEED=0
if [ "${SEED_ON_BOOT:-auto}" = "1" ] || [ "${SEED_ON_BOOT:-auto}" = "true" ]; then
  NEED_SEED=1
elif [ "${SEED_ON_BOOT:-auto}" = "auto" ]; then
  COUNT="$(user_count || echo 0)"
  if [ "$COUNT" = "0" ]; then
    NEED_SEED=1
  fi
fi

if [ "$NEED_SEED" = "1" ]; then
  echo "[boot] seeding (first boot / SEED_ON_BOOT)..."
  npx tsx prisma/seed.ts || echo "[boot] seed warning (non-fatal if migrate reset already seeded)"
else
  echo "[boot] skip seed (database already initialized)"
fi

echo "[boot] starting Next.js on :${PORT:-3010}"
exec npm run start
