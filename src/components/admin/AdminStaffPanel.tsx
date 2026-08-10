"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ADMIN_ACTION_OPTIONS,
  ADMIN_MENU_OPTIONS,
  ADMIN_PERMISSION_PRESETS,
  ADMIN_SETTING_GROUP_OPTIONS,
  ADMIN_VERTICAL_OPTIONS,
  EMPTY_ADMIN_PERMISSIONS,
  normalizeAdminPermissions,
  type AdminPermissions,
} from "@/lib/adminPermissions";
import { formatPhoneTr } from "@/lib/format";

type StaffRow = {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  role: string;
  isActive: boolean;
  adminPermissions: AdminPermissions;
  memberSince?: string;
  updatedAt?: string;
};

type SearchRow = {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  role: string;
  isActive: boolean;
  adminPermissions?: AdminPermissions;
};

function toggleIn<T extends string>(list: T[], key: T): T[] {
  return list.includes(key) ? list.filter((x) => x !== key) : [...list, key];
}

function PermSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 14,
        background: "#fff",
        display: "grid",
        gap: 10,
      }}
    >
      <div>
        <div style={{ fontWeight: 800, color: "#0f172a" }}>{title}</div>
        {hint ? <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{hint}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function AdminStaffPanel() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SearchRow | StaffRow | null>(null);
  const [perms, setPerms] = useState<AdminPermissions>({ ...EMPTY_ADMIN_PERMISSIONS });
  const [busy, setBusy] = useState(false);
  const [presets] = useState(ADMIN_PERMISSION_PRESETS);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/admin?view=staff");
      const d = await res.json();
      if (!res.ok) {
        setErr(d.error || "Yüklenemedi");
        return;
      }
      setStaff(d.staff || []);
    } catch {
      setErr("Bağlantı hatası");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/admin?view=staff-search&q=${encodeURIComponent(q.trim())}`);
        const d = await res.json();
        if (res.ok) setHits(d.users || []);
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => clearTimeout(t);
  }, [q]);

  function pickUser(u: SearchRow | StaffRow) {
    setSelected(u);
    setPerms(
      normalizeAdminPermissions(
        "adminPermissions" in u && u.adminPermissions
          ? u.adminPermissions
          : EMPTY_ADMIN_PERMISSIONS
      )
    );
    setMsg("");
    setErr("");
  }

  function applyPreset(id: string) {
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    setPerms(normalizeAdminPermissions(p.permissions));
  }

  const summary = useMemo(() => {
    return `${perms.menus.length} menü · ${perms.verticals.length} dikey · ${perms.actions.length} işlem · ${perms.settingGroups.length} ayar grubu`;
  }, [perms]);

  async function save() {
    if (!selected) return;
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-staff",
          userId: selected.id,
          permissions: perms,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setErr(d.error || "Kayıt başarısız");
        return;
      }
      setMsg("Alt yönetici kaydedildi");
      setSelected(d.staff);
      setPerms(normalizeAdminPermissions(d.staff.adminPermissions));
      await load();
    } catch {
      setErr("Bağlantı hatası");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(userId: string) {
    if (!confirm("Bu kullanıcının alt yönetici yetkisini kaldırmak istiyor musunuz?")) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke-staff", userId }),
      });
      const d = await res.json();
      if (!res.ok) {
        setErr(d.error || "İşlem başarısız");
        return;
      }
      setMsg("Yetki kaldırıldı");
      if (selected?.id === userId) {
        setSelected(null);
        setPerms({ ...EMPTY_ADMIN_PERMISSIONS });
      }
      await load();
    } catch {
      setErr("Bağlantı hatası");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {(msg || err) && (
        <div
          className="adm-card"
          style={{
            color: err ? "#b91c1c" : "#166534",
            fontWeight: 700,
            padding: 12,
          }}
        >
          {err || msg}
        </div>
      )}

      <div className="adm-card" style={{ display: "grid", gap: 12 }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>Kullanıcı seç / ata</div>
        <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
          Mevcut bir üyeyi arayın. Aynı giriş ekranından girecek; yalnızca verdiğiniz menü, dikey,
          işlem ve ayar gruplarını görecek.
        </p>
        <input
          className="adm-input"
          placeholder="Telefon, ad veya e-posta (en az 2 karakter)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {searching ? <div style={{ fontSize: 12, color: "#64748b" }}>Aranıyor…</div> : null}
        {hits.length > 0 && (
          <div style={{ display: "grid", gap: 6 }}>
            {hits.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => pickUser(u)}
                style={{
                  textAlign: "left",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border:
                    selected?.id === u.id ? "2px solid #f97316" : "1px solid #e2e8f0",
                  background: selected?.id === u.id ? "#fff7ed" : "#fff",
                  cursor: "pointer",
                }}
              >
                <strong>{u.name || "İsimsiz"}</strong> · {formatPhoneTr(u.phone)}
                {u.email ? ` · ${u.email}` : ""}
                <span style={{ color: "#64748b", marginLeft: 8 }}>
                  [{u.role === "STAFF" ? "Alt yönetici" : "Üye"}]
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="adm-card" style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Mevcut alt yöneticiler</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>{staff.length} kayıt</div>
          </div>
          <button type="button" className="btn-orange" style={{ padding: "8px 14px" }} onClick={() => load()}>
            Yenile
          </button>
        </div>
        {loading ? (
          <div>Yükleniyor…</div>
        ) : staff.length === 0 ? (
          <div style={{ color: "#64748b" }}>Henüz alt yönetici yok.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {staff.map((s) => (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  flexWrap: "wrap",
                  padding: 12,
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  background: selected?.id === s.id ? "#fff7ed" : "#f8fafc",
                }}
              >
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontWeight: 700 }}>{s.name || "İsimsiz"}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    {formatPhoneTr(s.phone)}
                    {s.email ? ` · ${s.email}` : ""}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                    {s.adminPermissions.menus.length} menü · {s.adminPermissions.actions.length} işlem
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-orange"
                  style={{ padding: "8px 12px" }}
                  onClick={() => pickUser(s)}
                >
                  Düzenle
                </button>
                <button
                  type="button"
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #fecaca",
                    background: "#fef2f2",
                    color: "#b91c1c",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                  disabled={busy}
                  onClick={() => revoke(s.id)}
                >
                  Yetkiyi kaldır
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected ? (
        <div className="adm-card" style={{ display: "grid", gap: 14 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>Yetki matrisi</div>
            <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
              {selected.name || "İsimsiz"} · {formatPhoneTr(selected.phone)} — {summary}
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b", alignSelf: "center" }}>
              Hazır paket:
            </span>
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id)}
                title={p.description}
                style={{
                  padding: "8px 12px",
                  borderRadius: 999,
                  border: "1px solid #fdba74",
                  background: "#fff7ed",
                  color: "#9a3412",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPerms({ ...EMPTY_ADMIN_PERMISSIONS })}
              style={{
                padding: "8px 12px",
                borderRadius: 999,
                border: "1px solid #e2e8f0",
                background: "#fff",
                fontWeight: 700,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Temizle
            </button>
          </div>

          <PermSection title="Menüler" hint="Sol menüde hangi bölümler görünsün">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 8 }}>
              {ADMIN_MENU_OPTIONS.map((m) => (
                <label
                  key={m.key}
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "flex-start",
                    padding: 8,
                    borderRadius: 8,
                    background: perms.menus.includes(m.key) ? "#ecfdf5" : "#f8fafc",
                    border: "1px solid #e2e8f0",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={perms.menus.includes(m.key)}
                    onChange={() =>
                      setPerms((p) => ({ ...p, menus: toggleIn(p.menus, m.key) }))
                    }
                  />
                  <span>
                    <strong>{m.label}</strong>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{m.description}</div>
                  </span>
                </label>
              ))}
            </div>
          </PermSection>

          <PermSection title="Dikeyler" hint="Vasıta / Alışveriş / Premium veri kapsamı">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {ADMIN_VERTICAL_OPTIONS.map((v) => (
                <label
                  key={v.key}
                  style={{
                    display: "inline-flex",
                    gap: 8,
                    alignItems: "center",
                    padding: "8px 12px",
                    borderRadius: 999,
                    border: "1px solid #e2e8f0",
                    background: perms.verticals.includes(v.key) ? "#eff6ff" : "#fff",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={perms.verticals.includes(v.key)}
                    onChange={() =>
                      setPerms((p) => ({ ...p, verticals: toggleIn(p.verticals, v.key) }))
                    }
                  />
                  {v.label}
                </label>
              ))}
            </div>
          </PermSection>

          <PermSection title="İşlem yetkileri" hint="Onay, red, kullanıcı, ödeme vb. kararlar">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 8 }}>
              {ADMIN_ACTION_OPTIONS.map((a) => (
                <label
                  key={a.key}
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "flex-start",
                    padding: 8,
                    borderRadius: 8,
                    background: perms.actions.includes(a.key) ? "#fef3c7" : "#f8fafc",
                    border: "1px solid #e2e8f0",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={perms.actions.includes(a.key)}
                    onChange={() =>
                      setPerms((p) => ({ ...p, actions: toggleIn(p.actions, a.key) }))
                    }
                  />
                  <span>
                    <strong>{a.label}</strong>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{a.description}</div>
                  </span>
                </label>
              ))}
            </div>
          </PermSection>

          <PermSection
            title="Ayar grupları"
            hint="Sistem ayarlarından hangi grupları görüp kaydedebilsin (settings yetkisi de gerekir)"
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 8 }}>
              {ADMIN_SETTING_GROUP_OPTIONS.map((g) => (
                <label
                  key={g.key}
                  style={{
                    display: "inline-flex",
                    gap: 8,
                    alignItems: "center",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    background: perms.settingGroups.includes(g.key) ? "#f5f3ff" : "#fff",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={perms.settingGroups.includes(g.key)}
                    onChange={() =>
                      setPerms((p) => ({
                        ...p,
                        settingGroups: toggleIn(p.settingGroups, g.key),
                      }))
                    }
                  />
                  {g.label}
                </label>
              ))}
            </div>
          </PermSection>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn-orange"
              style={{ padding: "12px 18px", fontWeight: 800 }}
              disabled={busy}
              onClick={() => save()}
            >
              {busy ? "Kaydediliyor…" : "Alt yöneticiyi kaydet"}
            </button>
            <button
              type="button"
              style={{
                padding: "12px 18px",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                background: "#fff",
                fontWeight: 700,
                cursor: "pointer",
              }}
              onClick={() => {
                setSelected(null);
                setPerms({ ...EMPTY_ADMIN_PERMISSIONS });
              }}
            >
              İptal
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
