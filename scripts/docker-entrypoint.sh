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

mark_failed_rolled_back() {
  node <<'NODE' || true
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  try {
    const rows = await p.$queryRawUnsafe(
      `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL OR logs LIKE '%failed%'`
    ).catch(() => []);
    const failed = await p.$queryRawUnsafe(
      `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NULL`
    ).catch(() => []);
    const names = [...new Set([...(rows || []), ...(failed || [])].map((r) => r.migration_name).filter(Boolean))];
    for (const name of names) {
      console.log("[boot] resolve rolled-back:", name);
      const { execSync } = require("child_process");
      try {
        execSync(`npx prisma migrate resolve --rolled-back "${name}"`, { stdio: "inherit" });
      } catch {}
    }
  } finally {
    await p.$disconnect().catch(() => {});
  }
})();
NODE
}

echo "[boot] applying migrations..."
if ! npx prisma migrate deploy; then
  USERS="$(user_count)"
  echo "[boot] migrate deploy failed (users=${USERS})"

  mark_failed_rolled_back

  if [ "$USERS" = "0" ]; then
    echo "[boot] empty DB — hard reset schema"
    npx prisma migrate reset --force || true
    if ! npx prisma migrate deploy; then
      echo "[boot] migrate still failing — schema push bootstrap"
      npx prisma db push --accept-data-loss --skip-generate
    fi
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
