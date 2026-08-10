#!/bin/sh
# Acil: çalışan image'da Secure cookie'yi kapat (tam rebuild beklemeden)
set -eu
cd /app
echo "[patch] searching .next for session cookie secure flag..."
find .next -type f \( -name '*.js' -o -name '*.js.map' \) -print0 2>/dev/null \
  | xargs -0 grep -l 'teklifbu_session' 2>/dev/null \
  | while read -r f; do
      sed -i \
        -e 's/secure:process.env.NODE_ENV==="production"/secure:!1/g' \
        -e 's/secure:process.env.NODE_ENV==="production"/secure:!1/g' \
        -e 's/secure:!0/secure:!1/g' \
        -e 's/; Secure;/; /g' \
        "$f" || true
      echo "[patch] touched $f"
    done
echo "[patch] done — restart web container"
