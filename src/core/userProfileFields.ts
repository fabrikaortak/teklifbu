import { getSetting } from "@/core/settings";

export type ProfileFieldType =
  | "text"
  | "textarea"
  | "email"
  | "phone"
  | "tc"
  | "date"
  | "accountType"
  | "password";

export type ProfileFieldDef = {
  key: string;
  label: string;
  type: ProfileFieldType;
  group: string;
  groupLabel: string;
  placeholder?: string;
  /** User tablosundaki kolon (yoksa profile Json) */
  column?: "name" | "email" | "accountType" | "phone" | "avatarUrl";
  readOnly?: boolean;
  maxLength?: number;
  hint?: string;
};

export type ProfileFieldConfig = { enabled: boolean; required: boolean };
export type UserProfileFieldsConfig = Record<string, ProfileFieldConfig>;

/** Admin’de açılıp kapatılabilen profil alan kataloğu */
export const USER_PROFILE_FIELD_DEFS: ProfileFieldDef[] = [
  {
    key: "firstName",
    label: "Ad",
    type: "text",
    group: "kimlik",
    groupLabel: "Kimlik",
    placeholder: "Adınız",
    maxLength: 60,
  },
  {
    key: "lastName",
    label: "Soyad",
    type: "text",
    group: "kimlik",
    groupLabel: "Kimlik",
    placeholder: "Soyadınız",
    maxLength: 60,
  },
  {
    key: "tcKimlik",
    label: "TC Kimlik No",
    type: "tc",
    group: "kimlik",
    groupLabel: "Kimlik",
    placeholder: "11 haneli TC",
    maxLength: 11,
  },
  {
    key: "birthDate",
    label: "Doğum Tarihi",
    type: "date",
    group: "kimlik",
    groupLabel: "Kimlik",
  },
  {
    key: "email",
    label: "E-posta",
    type: "email",
    group: "iletisim",
    groupLabel: "İletişim",
    placeholder: "ornek@mail.com",
    column: "email",
  },
  {
    key: "phone",
    label: "Telefon",
    type: "phone",
    group: "iletisim",
    groupLabel: "İletişim",
    column: "phone",
    readOnly: true,
    hint: "Telefon numarası üyelik ile bağlıdır; değiştirilemez.",
  },
  {
    key: "address",
    label: "Adres",
    type: "textarea",
    group: "adres",
    groupLabel: "Adres",
    placeholder: "Mahalle, sokak, bina no…",
    maxLength: 400,
  },
  {
    key: "city",
    label: "İl",
    type: "text",
    group: "adres",
    groupLabel: "Adres",
    placeholder: "İl",
    maxLength: 60,
  },
  {
    key: "district",
    label: "İlçe",
    type: "text",
    group: "adres",
    groupLabel: "Adres",
    placeholder: "İlçe",
    maxLength: 60,
  },
  {
    key: "postalCode",
    label: "Posta Kodu",
    type: "text",
    group: "adres",
    groupLabel: "Adres",
    placeholder: "34000",
    maxLength: 10,
  },
  {
    key: "companyName",
    label: "Firma Ünvanı",
    type: "text",
    group: "is",
    groupLabel: "İş / Firma",
    placeholder: "Firma adı",
    maxLength: 120,
  },
  {
    key: "taxOffice",
    label: "Vergi Dairesi",
    type: "text",
    group: "is",
    groupLabel: "İş / Firma",
    maxLength: 80,
  },
  {
    key: "taxNumber",
    label: "Vergi No",
    type: "text",
    group: "is",
    groupLabel: "İş / Firma",
    maxLength: 20,
  },
  {
    key: "accountType",
    label: "Hesap Türü",
    type: "accountType",
    group: "hesap",
    groupLabel: "Hesap",
    column: "accountType",
  },
  {
    key: "password",
    label: "Şifre Değiştir",
    type: "password",
    group: "guvenlik",
    groupLabel: "Güvenlik",
    hint: "Mevcut şifrenizi girip yeni şifre belirleyin.",
  },
];

export const DEFAULT_USER_PROFILE_FIELDS: UserProfileFieldsConfig = Object.fromEntries(
  USER_PROFILE_FIELD_DEFS.map((f) => {
    const alwaysOn = ["firstName", "lastName", "email", "phone", "accountType", "password"].includes(f.key);
    const optionalOn = ["tcKimlik", "address", "city", "district", "birthDate"].includes(f.key);
    return [
      f.key,
      {
        enabled: alwaysOn || optionalOn,
        required: f.key === "firstName" || f.key === "lastName",
      },
    ];
  })
);

function asConfig(raw: unknown): UserProfileFieldsConfig {
  const base = { ...DEFAULT_USER_PROFILE_FIELDS };
  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Record<string, unknown>;
  for (const def of USER_PROFILE_FIELD_DEFS) {
    const row = obj[def.key];
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    base[def.key] = {
      enabled: r.enabled !== false,
      required: Boolean(r.required) && r.enabled !== false,
    };
  }
  return base;
}

export async function getUserProfileFieldsConfig(): Promise<UserProfileFieldsConfig> {
  const raw = await getSetting<unknown>("user_profile_fields", DEFAULT_USER_PROFILE_FIELDS);
  return asConfig(raw);
}

export function getEnabledProfileFields(config: UserProfileFieldsConfig): ProfileFieldDef[] {
  return USER_PROFILE_FIELD_DEFS.filter((f) => config[f.key]?.enabled !== false);
}

export function parseProfileJson(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v == null) continue;
    out[k] = String(v);
  }
  return out;
}

/** Ad + soyad → name; eski name’den geriye dönük bölme */
export function splitDisplayName(name?: string | null): { firstName: string; lastName: string } {
  const t = String(name || "").trim();
  if (!t) return { firstName: "", lastName: "" };
  const parts = t.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export function buildDisplayName(firstName: string, lastName: string, fallback = "") {
  const n = [firstName, lastName].map((x) => String(x || "").trim()).filter(Boolean).join(" ");
  return n || fallback;
}

function isValidTc(raw: string): boolean {
  const t = String(raw || "").replace(/\D/g, "");
  if (!/^[1-9]\d{10}$/.test(t)) return false;
  const d = t.split("").map(Number);
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  const check10 = (((odd * 7 - even) % 10) + 10) % 10;
  if (check10 !== d[9]) return false;
  const check11 = d.slice(0, 10).reduce((a, b) => a + b, 0) % 10;
  return check11 === d[10];
}

export function validateProfilePayload(input: {
  values: Record<string, string>;
  config: UserProfileFieldsConfig;
  /** Şifre ayrı doğrulanır */
  skipPassword?: boolean;
}): { ok: true; values: Record<string, string> } | { ok: false; error: string } {
  const cleaned: Record<string, string> = {};
  for (const def of USER_PROFILE_FIELD_DEFS) {
    const cfg = input.config[def.key] || { enabled: false, required: false };
    if (!cfg.enabled) continue;
    if (def.type === "password") {
      if (input.skipPassword) continue;
      continue;
    }
    if (def.readOnly) continue;

    let v = String(input.values[def.key] ?? "").trim();
    if (def.type === "tc") v = v.replace(/\D/g, "");
    if (def.type === "email") v = v.toLowerCase();

    if (cfg.required && !v) {
      return { ok: false, error: `${def.label} zorunludur` };
    }
    if (!v) {
      cleaned[def.key] = "";
      continue;
    }
    if (def.maxLength && v.length > def.maxLength) {
      return { ok: false, error: `${def.label} en fazla ${def.maxLength} karakter olabilir` };
    }
    if (def.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      return { ok: false, error: "Geçerli bir e-posta girin" };
    }
    if (def.type === "tc" && !isValidTc(v)) {
      return { ok: false, error: "Geçerli bir TC Kimlik No girin" };
    }
    if (def.type === "accountType" && !["BIREYSEL_TICARI", "TICARI", "BIREYSEL", "EMLAKCI", "GALERICI"].includes(v)) {
      return { ok: false, error: "Geçersiz hesap türü" };
    }
    cleaned[def.key] = v;
  }
  return { ok: true, values: cleaned };
}
