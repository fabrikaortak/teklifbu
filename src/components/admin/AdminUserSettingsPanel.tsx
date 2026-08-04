"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminToast } from "@/components/admin/AdminToast";
import {
  DEFAULT_USER_PROFILE_FIELDS,
  USER_PROFILE_FIELD_DEFS,
  type ProfileFieldConfig,
  type UserProfileFieldsConfig,
} from "@/core/userProfileFields";

function mergeConfig(raw: unknown): UserProfileFieldsConfig {
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

export function AdminUserSettingsPanel() {
  const [draft, setDraft] = useState<UserProfileFieldsConfig>(DEFAULT_USER_PROFILE_FIELDS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin?view=settings");
      if (!res.ok) {
        setError(res.status === 403 ? "Yetkisiz" : "Yüklenemedi");
        return;
      }
      const json = await res.json();
      setDraft(mergeConfig(json.settings?.user_profile_fields));
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function patch(key: string, next: Partial<ProfileFieldConfig>) {
    setDraft((prev) => {
      const cur = prev[key] || { enabled: false, required: false };
      const enabled = next.enabled !== undefined ? next.enabled : cur.enabled;
      let required = next.required !== undefined ? next.required : cur.required;
      if (!enabled) required = false;
      return { ...prev, [key]: { enabled, required } };
    });
  }

  async function save() {
    setSaving(true);
    try {
      const payload: UserProfileFieldsConfig = {};
      for (const def of USER_PROFILE_FIELD_DEFS) {
        const row = draft[def.key] || { enabled: false, required: false };
        payload[def.key] = {
          enabled: Boolean(row.enabled),
          required: Boolean(row.enabled) && Boolean(row.required),
        };
      }
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-settings",
          settings: { user_profile_fields: payload },
        }),
      });
      if (!res.ok) {
        setMsg("Kayıt başarısız");
        return;
      }
      setDraft(payload);
      setMsg("Kullanıcı ayarları kaydedildi");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="adm-card">Yükleniyor...</div>;
  if (error) {
    return (
      <div className="adm-card" style={{ display: "grid", gap: 12 }}>
        <div style={{ color: "#b91c1c", fontWeight: 700 }}>{error}</div>
        <button className="btn-orange" style={{ padding: 12, width: 160 }} onClick={load}>
          Tekrar Dene
        </button>
      </div>
    );
  }

  const groups = Array.from(new Map(USER_PROFILE_FIELD_DEFS.map((f) => [f.group, f.groupLabel])).entries());

  return (
    <div className="adm-panel-wrap">
      <AdminToast
        message={msg || null}
        tone={msg && /başarısız|hata/i.test(msg) ? "err" : "ok"}
        onClose={() => setMsg("")}
      />

      <div className="adm-card" style={{ display: "grid", gap: 12 }}>
        <div>
          <h2 style={{ margin: "0 0 6px", fontSize: 16 }}>Profil alanları</h2>
          <p style={{ margin: 0, fontSize: 13, color: "var(--adm-muted)", lineHeight: 1.5 }}>
            Kullanıcının Hesabım → Hesap Ayarları ekranında hangi alanların görüneceğini seçin. Kapalı alanlar
            formda çıkmaz. Zorunlu alanlar boş bırakılamaz.
          </p>
        </div>

        {groups.map(([group, groupLabel]) => (
          <div key={group} style={{ display: "grid", gap: 8 }}>
            <h3 style={{ margin: "8px 0 0", fontSize: 14, fontWeight: 800 }}>{groupLabel}</h3>
            <div style={{ overflowX: "auto" }}>
              <table className="adm-table" style={{ width: "100%", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "8px 10px" }}>Alan</th>
                    <th style={{ textAlign: "center", padding: "8px 10px", width: 110 }}>Açık</th>
                    <th style={{ textAlign: "center", padding: "8px 10px", width: 130 }}>Zorunlu</th>
                    <th style={{ textAlign: "left", padding: "8px 10px" }}>Not</th>
                  </tr>
                </thead>
                <tbody>
                  {USER_PROFILE_FIELD_DEFS.filter((f) => f.group === group).map((f) => {
                    const row = draft[f.key] || { enabled: false, required: false };
                    return (
                      <tr key={f.key} style={{ borderTop: "1px solid #e2e8f0" }}>
                        <td style={{ padding: "10px" }}>
                          <strong>{f.label}</strong>
                          <div style={{ fontSize: 12, color: "#64748b" }}>{f.key}</div>
                        </td>
                        <td style={{ padding: "10px", textAlign: "center" }}>
                          <button
                            type="button"
                            className={row.enabled ? "btn-orange" : "btn-outline"}
                            style={{ padding: "6px 12px", minWidth: 72 }}
                            onClick={() => patch(f.key, { enabled: !row.enabled })}
                          >
                            {row.enabled ? "Açık" : "Kapalı"}
                          </button>
                        </td>
                        <td style={{ padding: "10px", textAlign: "center" }}>
                          <button
                            type="button"
                            className={row.enabled && row.required ? "btn-orange" : "btn-outline"}
                            style={{
                              padding: "6px 12px",
                              minWidth: 96,
                              opacity: row.enabled && f.type !== "password" && !f.readOnly ? 1 : 0.45,
                            }}
                            disabled={!row.enabled || f.type === "password" || Boolean(f.readOnly)}
                            onClick={() => patch(f.key, { required: !row.required })}
                          >
                            {row.enabled && row.required ? "Zorunlu" : "İsteğe bağlı"}
                          </button>
                        </td>
                        <td style={{ padding: "10px", fontSize: 12, color: "#64748b" }}>
                          {f.readOnly
                            ? "Salt okunur"
                            : f.type === "password"
                              ? "Şifre değiştirme bölümü"
                              : row.enabled
                                ? row.required
                                  ? "Kullanıcı doldurmak zorunda"
                                  : "Doldurulmayabilir"
                                : "Formda gizli"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          <button className="btn-orange" style={{ padding: 12, width: 200 }} disabled={saving} onClick={save}>
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
          <button type="button" className="btn-outline" style={{ padding: 12 }} disabled={saving} onClick={load}>
            Vazgeç / Yenile
          </button>
        </div>
      </div>
    </div>
  );
}
