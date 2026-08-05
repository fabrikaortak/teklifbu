/**
 * Staging ortam koruması — production'a yanlışlıkla dokunmayı engeller.
 */
export type DbFingerprint = {
  maskedUrl: string;
  host: string;
  port: string;
  database: string;
  user: string;
  isLocalhost: boolean;
  looksProduction: boolean;
};

export function parseDatabaseUrl(raw?: string | null): DbFingerprint {
  const url = String(raw || process.env.DATABASE_URL || "").trim();
  const empty: DbFingerprint = {
    maskedUrl: "(empty)",
    host: "",
    port: "",
    database: "",
    user: "",
    isLocalhost: false,
    looksProduction: true,
  };
  if (!url) return empty;

  let host = "";
  let port = "";
  let database = "";
  let user = "";
  try {
    const u = new URL(url.replace(/^postgresql:/i, "http:").replace(/^postgres:/i, "http:"));
    host = u.hostname;
    port = u.port || "5432";
    database = (u.pathname || "").replace(/^\//, "").split("?")[0];
    user = decodeURIComponent(u.username || "");
  } catch {
    const m = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:/]+):?(\d*)\/([^?]+)/i);
    if (m) {
      user = m[1];
      host = m[3];
      port = m[4] || "5432";
      database = m[5];
    }
  }

  const hostLower = host.toLowerCase();
  const isLocalhost =
    hostLower === "localhost" ||
    hostLower === "127.0.0.1" ||
    hostLower === "::1" ||
    hostLower.endsWith(".local");

  const prodHints = ["prod", "production", "rds.amazonaws.com", "azure.com", "neon.tech", "supabase.co"];
  const looksProduction =
    !isLocalhost &&
    (prodHints.some((h) => hostLower.includes(h) || database.toLowerCase().includes(h)) ||
      process.env.APP_ENV === "production" ||
      process.env.VERCEL_ENV === "production");

  const maskedUrl = `postgresql://${user}:***@${host}:${port}/${database}`;

  return { maskedUrl, host, port, database, user, isLocalhost, looksProduction };
}

/**
 * Staging script'leri için zorunlu guard.
 * - NODE_ENV=production → stop
 * - production-looking DB → stop
 * - STAGING_CONFIRMATION=I_CONFIRM_STAGING zorunlu (unless allowLocalDev without confirm for localhost + explicit ALLOW)
 */
export function assertStagingSafe(opts?: {
  requireConfirmation?: boolean;
  allowLocalhostWithoutConfirm?: boolean;
}): DbFingerprint {
  if (String(process.env.NODE_ENV || "").toLowerCase() === "production") {
    throw new Error("REFUSED: NODE_ENV=production — staging script blocked");
  }

  const fp = parseDatabaseUrl(process.env.DATABASE_URL);
  if (!fp.host) {
    throw new Error("REFUSED: DATABASE_URL missing or unparseable");
  }
  if (fp.looksProduction) {
    throw new Error(`REFUSED: DATABASE_URL looks like production (${fp.maskedUrl})`);
  }

  const confirm = String(process.env.STAGING_CONFIRMATION || "").trim();
  const needConfirm = opts?.requireConfirmation !== false;
  const localOk =
    opts?.allowLocalhostWithoutConfirm &&
    fp.isLocalhost &&
    String(process.env.ALLOW_LOCAL_STAGING || "") === "1";

  if (needConfirm && confirm !== "I_CONFIRM_STAGING" && !localOk) {
    throw new Error(
      "REFUSED: set STAGING_CONFIRMATION=I_CONFIRM_STAGING (or ALLOW_LOCAL_STAGING=1 on localhost)"
    );
  }

  return fp;
}
