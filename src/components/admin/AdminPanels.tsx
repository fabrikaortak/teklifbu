"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { formatTl, remainingLabel, paymentStatusLabel, paymentPurposeLabel } from "@/lib/format";
import { paymentMetaDetails } from "@/lib/paymentDetails";
import { extractPaymentVatTl } from "@/lib/vat";
import { useDialog } from "@/components/ui/ConfirmDialog";
import {
  BID_STATUS_OPTIONS,
  LISTING_STATUS_OPTIONS,
  bidStatusLabel,
  listingStatusLabel,
} from "@/lib/listingStatus";
import { formatListingNo } from "@/lib/listingNo";
import { AdminToast } from "@/components/admin/AdminToast";
import {
  type AdminVertical,
  ADMIN_VERTICAL_META,
  categoryMatchesVertical,
  contentMatchesVertical,
} from "@/lib/adminVertical";
import { ExternalLink, Star, X } from "lucide-react";
import {
  normalizeListingExpiryRules,
  type ListingExpiryRules,
} from "@/lib/listingExpiryRules";
import { BusinessTypesEditor } from "@/components/admin/BusinessTypesEditor";
import { AdminUserDetailModal } from "@/components/admin/AdminUserDetailModal";
import {
  accountTypeLabelTr,
  commercialSubtypeLabelTr,
  isCorporateAccount,
} from "@/lib/accountTypes";
import {
  COMMERCIAL_BUSINESS_TYPES_SETTING_KEY,
  type CommercialBusinessType,
  normalizeCommercialBusinessTypes,
} from "@/lib/commercialBusinessTypes";

export type AdminTableFilters = {
  listingQ?: string;
  listingStatus?: string;
  listingEnding?: string;
  bidQ?: string;
  bidStatus?: string;
  userQ?: string;
  userActive?: string;
  userAccountType?: string;
  userSegment?: string;
  userCommercialSubtype?: string;
  paymentQ?: string;
  paymentStatus?: string;
  paymentPurpose?: string;
  messageQ?: string;
  messageUnread?: string;
};

function buildAdminTablesQuery(filters: AdminTableFilters, vertical?: AdminVertical | null) {
  const qs = new URLSearchParams({ view: "tables" });
  (Object.entries(filters) as Array<[keyof AdminTableFilters, string | undefined]>).forEach(
    ([key, value]) => {
      if (value) qs.set(key, value);
    }
  );
  if (vertical) qs.set("vertical", vertical);
  return qs.toString();
}

export function useAdminData(vertical?: AdminVertical | null) {
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const [popup, setPopup] = useState<null | { type: string; payload?: any }>(null);
  const [loadError, setLoadError] = useState("");
  const [filters, setFilters] = useState<AdminTableFilters>({});
  const filtersRef = useRef<AdminTableFilters>({});
  filtersRef.current = filters;

  async function load(nextFilters?: AdminTableFilters) {
    const f = nextFilters ?? filtersRef.current;
    if (nextFilters) setFilters(nextFilters);
    setLoadError("");
    try {
      const res = await fetch(`/api/admin?${buildAdminTablesQuery(f, vertical)}`);
      if (!res.ok) {
        setLoadError(res.status === 403 ? "Yetkisiz" : "Yüklenemedi");
        return;
      }
      setData(await res.json());
    } catch {
      setLoadError("Bağlantı hatası");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vertical]);

  return {
    data,
    setData,
    msg,
    setMsg,
    popup,
    setPopup,
    load,
    loadError,
    filters,
    setFilters,
    applyFilters: (partial: AdminTableFilters) => {
      const next: AdminTableFilters = { ...filtersRef.current, ...partial };
      (Object.keys(partial) as Array<keyof AdminTableFilters>).forEach((k) => {
        if (partial[k] === "") delete next[k];
      });
      return load(next);
    },
  };
}

function AdminFilterBar({
  children,
  resultCount,
}: {
  children: ReactNode;
  resultCount?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
        alignItems: "center",
        marginBottom: 12,
        padding: "10px 12px",
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
      }}
    >
      {children}
      {typeof resultCount === "number" ? (
        <span style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 700, color: "#64748b" }}>
          {resultCount} kayıt
        </span>
      ) : null}
    </div>
  );
}

function FilterInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="input"
      {...props}
      style={{
        minWidth: 180,
        maxWidth: 280,
        padding: "8px 12px",
        fontSize: 13,
        ...(props.style || {}),
      }}
    />
  );
}

function FilterSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className="select"
      {...props}
      style={{
        minWidth: 140,
        padding: "8px 12px",
        fontSize: 13,
        ...(props.style || {}),
      }}
    />
  );
}

/** Arama yazarken kısa gecikmeyle filtre uygula */
function useDebouncedFilter(
  apply: (partial: AdminTableFilters) => void | Promise<unknown>,
  key: keyof AdminTableFilters,
  delay = 350
) {
  const [value, setValue] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  function onChange(next: string) {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void apply({ [key]: next.trim() || "" });
    }, delay);
  }
  return { value, onChange, setValue };
}

export function AdminSettingsPanel({
  onlyGroups,
  excludeGroups,
  onlyKeys,
  excludeKeys,
}: {
  onlyGroups?: string[];
  excludeGroups?: string[];
  onlyKeys?: string[];
  excludeKeys?: string[];
} = {}) {
  const [data, setData] = useState<{ settings: Record<string, unknown>; meta: Record<string, any> } | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [msg, setMsg] = useState("");
  const [loadError, setLoadError] = useState("");
  const clearMsg = useCallback(() => setMsg(""), []);

  const load = useCallback(async (force = false) => {
    setLoadError("");
    try {
      const res = await fetch(`/api/admin?view=settings${force ? "&force=1" : ""}`);
      if (!res.ok) {
        setLoadError(res.status === 403 ? "Yetkisiz" : "Yüklenemedi");
        return;
      }
      const json = await res.json();
      setData(json);
      setDraft(json.settings || {});
    } catch {
      setLoadError("Bağlantı hatası");
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  if (loadError && !data) {
    return (
      <div className="adm-card" style={{ display: "grid", gap: 12 }}>
        <div style={{ color: "#b91c1c", fontWeight: 700 }}>{loadError}</div>
        <button className="btn-orange" style={{ padding: 12, width: 160 }} onClick={() => load(true)}>
          Tekrar Dene
        </button>
      </div>
    );
  }

  if (!data) return <div className="adm-card">Yükleniyor...</div>;
  const groups = (
    Array.from(new Set(Object.values(data.meta).map((m: any) => m.group))) as string[]
  ).filter((g) => {
    if (onlyKeys?.length) {
      return Object.entries(data.meta).some(
        ([key, meta]: any) =>
          meta.group === g &&
          onlyKeys.includes(key) &&
          (!excludeKeys?.length || !excludeKeys.includes(key))
      );
    }
    if (onlyGroups?.length && !onlyGroups.includes(g)) return false;
    if (excludeGroups?.length && excludeGroups.includes(g)) return false;
    if (excludeKeys?.length) {
      return Object.entries(data.meta).some(
        ([key, meta]: any) => meta.group === g && !excludeKeys.includes(key)
      );
    }
    return true;
  });

  async function saveSettings() {
    const payload = { ...draft };
    const expiry = normalizeListingExpiryRules(payload.listing_expiry_rules);
    payload.listing_expiry_rules = expiry;
    payload.post_end_selection_minutes = expiry.bidding.selectionMinutes;
    if (expiry.buyButtonLabel) {
      payload.escrow_button_label = expiry.buyButtonLabel;
    }
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save-settings", settings: payload }),
    });
    if (!res.ok) {
      setMsg("Kayıt başarısız");
      return;
    }
    setMsg("Ayarlar kaydedildi");
    await load(true);
  }

  const groupLabel: Record<string, string> = {
    bid: "Teklif Kuralları",
    token: "Jeton",
    listing: "İlan",
    lifecycle: "Yaşam Döngüsü",
    auth: "Kimlik Doğrulama",
    commercial: "Ticari Üyelik",
    notification: "Bildirimler",
    pwa: "PWA",
    general: "Genel",
    v2: "Tema",
    premium: "Premium Kapasite",
    eids: "EİDS",
    payment: "Ödeme / Sanal POS",
    escrow: "Güvenli Öde (Escrow)",
    ai: "AI (Yapay Zeka)",
    account: "Kullanıcı / Hesap",
    ads: "Reklam Ayarları",
  };

  const toastTone = msg && /başarısız|hata|edilmedi/i.test(msg) ? "err" : "ok";
  const isTemaOnly = onlyGroups?.length === 1 && onlyGroups[0] === "v2";
  const isCompact = Boolean(onlyKeys?.length);

  return (
    <div className="adm-panel-wrap">
      <AdminToast message={msg || null} tone={toastTone} onClose={clearMsg} />
      {!isTemaOnly && !isCompact && (
        <div className="adm-card" style={{ background: "#f8fafc", borderStyle: "dashed" }}>
          <h2 style={{ marginTop: 0, fontSize: 14 }}>EİDS notu</h2>
          <p style={{ margin: 0, fontSize: 13, color: "var(--adm-muted)", lineHeight: 1.5 }}>
            Varsayılan <strong>kapalı</strong>dır; mevcut üyelik/ilan/teklif akışı değişmez. Açıp modu{" "}
            <strong>mock</strong> bırakırsanız kapsam kategorilerindeki yeni ilanlar test için otomatik doğrulanır ve
            rozet metni görünür; yayın engellenmez. <strong>live</strong> + firma kodu gelince gerçek Bakanlık API’sine
            bağlanır.
          </p>
        </div>
      )}
      {isTemaOnly && (
        <div className="adm-card" style={{ background: "#fff7ed", borderColor: "#fed7aa" }}>
          <h2 style={{ marginTop: 0, fontSize: 14 }}>Tema ayarları</h2>
          <p style={{ margin: 0, fontSize: 13, color: "var(--adm-muted)", lineHeight: 1.5 }}>
            Site teması, kategori ağacı, üst / alt kuşak rengi, satırdaki ilan (4 / 5 / 6), vitrin satır sayısı ve ilan
            detay düzeni (klasik / Sahibinden) buradan seçilir. Sayfa boyutu = satır × kolon (örn. 3×4=12). Kayıttan
            sonra ana siteyi bir kez yenileyin.
          </p>
        </div>
      )}
      {groups.map((group) => (
        <div key={group} className={isCompact ? undefined : "adm-card"} style={isCompact ? { display: "grid", gap: 12 } : undefined}>
          {!isCompact && (
            <h2 style={{ marginTop: 0, fontSize: 15, fontWeight: 800 }}>{groupLabel[group] || group}</h2>
          )}
          <div style={{ display: "grid", gap: 18 }}>
            {Object.entries(data.meta)
              .filter(
                ([key, meta]: any) =>
                  meta.group === group &&
                  (!onlyKeys?.length || onlyKeys.includes(key)) &&
                  (!excludeKeys?.length || !excludeKeys.includes(key))
              )
              .map(([key, meta]: any) => (
                <div
                  key={key}
                  style={{
                    display: "grid",
                    gridTemplateColumns: isCompact ? "1fr auto" : "minmax(200px, 300px) 1fr",
                    gap: 14,
                    alignItems: "start",
                    paddingBottom: isCompact ? 0 : 14,
                    borderBottom: isCompact ? "none" : "1px solid #eef2f7",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{meta.label}</div>
                    {meta.description && (
                      <div style={{ fontSize: 12.5, color: "var(--adm-muted)", marginTop: 4, lineHeight: 1.45 }}>
                        {meta.description}
                      </div>
                    )}
                  </div>
                  <SettingInput
                    settingKey={key}
                    meta={meta}
                    value={draft[key]}
                    onChange={(v) => setDraft((d) => ({ ...d, [key]: v }))}
                  />
                </div>
              ))}
          </div>
        </div>
      ))}
      <button className="btn-orange" style={{ padding: 14, width: 220 }} onClick={saveSettings}>
        {isTemaOnly ? "Tema Ayarlarını Kaydet" : isCompact ? "Kaydet" : "Tüm Ayarları Kaydet"}
      </button>
    </div>
  );
}

export function AdminUsersPanel() {
  const { data, load, filters, applyFilters } = useAdminData();
  const q = useDebouncedFilter(applyFilters, "userQ");
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  if (!data) return <div className="adm-card">Yükleniyor...</div>;

  const counts = data.userCounts || { all: 0, individual: 0, corporate: 0, bySubtype: {} };
  const businessTypes: CommercialBusinessType[] = normalizeCommercialBusinessTypes(
    data.settings?.[COMMERCIAL_BUSINESS_TYPES_SETTING_KEY]
  ).filter((t) => t.active);

  const segment = (filters.userSegment || "all") as "all" | "individual" | "corporate";
  const subtype = filters.userCommercialSubtype || "";

  function setSegment(next: "all" | "individual" | "corporate") {
    applyFilters({
      userSegment: next === "all" ? "" : next,
      userCommercialSubtype: "",
      userAccountType: "",
    });
  }

  function setSubtype(key: string) {
    applyFilters({
      userSegment: "corporate",
      userCommercialSubtype: key,
      userAccountType: "",
    });
  }

  const mainTabs: Array<{ key: "all" | "individual" | "corporate"; label: string; count: number }> = [
    { key: "all", label: "Tüm kullanıcılar", count: Number(counts.all) || 0 },
    { key: "individual", label: "Bireysel", count: Number(counts.individual) || 0 },
    { key: "corporate", label: "Kurumsal", count: Number(counts.corporate) || 0 },
  ];

  return (
    <div className="adm-card" style={{ overflow: "auto", display: "grid", gap: 14 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {mainTabs.map((t) => {
          const active = segment === t.key;
          return (
            <button
              key={t.key}
              type="button"
              className={active ? "btn-orange" : "btn-outline"}
              style={{ padding: "8px 14px", fontSize: 13, fontWeight: 700 }}
              onClick={() => setSegment(t.key)}
            >
              {t.label} ({t.count})
            </button>
          );
        })}
      </div>

      {segment === "corporate" && businessTypes.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button
            type="button"
            className={!subtype ? "btn-orange" : "btn-outline"}
            style={{ padding: "7px 12px", fontSize: 12, fontWeight: 700 }}
            onClick={() => setSegment("corporate")}
          >
            Tümü ({Number(counts.corporate) || 0})
          </button>
          {businessTypes.map((bt) => {
            const c = Number(counts.bySubtype?.[bt.key]) || 0;
            const active = subtype === bt.key;
            return (
              <button
                key={bt.key}
                type="button"
                className={active ? "btn-orange" : "btn-outline"}
                style={{ padding: "7px 12px", fontSize: 12, fontWeight: 700 }}
                onClick={() => setSubtype(bt.key)}
              >
                {bt.label} ({c})
              </button>
            );
          })}
        </div>
      )}

      <AdminFilterBar resultCount={(data.users || []).length}>
        <FilterInput
          placeholder="Ad veya telefon ara…"
          value={q.value}
          onChange={(e) => q.onChange(e.target.value)}
        />
        <FilterSelect
          value={filters.userActive || ""}
          onChange={(e) => applyFilters({ userActive: e.target.value })}
        >
          <option value="">Tüm durumlar</option>
          <option value="1">Aktif</option>
          <option value="0">Pasif</option>
        </FilterSelect>
        {(filters.userQ || filters.userActive || filters.userSegment || filters.userCommercialSubtype) && (
          <button
            type="button"
            className="btn-outline"
            style={{ padding: "8px 12px", fontSize: 13 }}
            onClick={() => {
              q.setValue("");
              load({});
            }}
          >
            Temizle
          </button>
        )}
      </AdminFilterBar>
      <table className="adm-table">
        <thead>
          <tr>
            <th>Ad</th>
            <th>Telefon</th>
            <th>Tip</th>
            <th>Faaliyet</th>
            <th>Rol</th>
            <th>Jeton</th>
            <th>Durum</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {(data.users || []).length === 0 && (
            <tr>
              <td colSpan={8} style={{ color: "var(--adm-muted)" }}>
                Filtreye uyan kullanıcı yok.
              </td>
            </tr>
          )}
          {data.users.map((u: any) => {
            const subs: string[] = Array.isArray(u.commercialSubtypes) ? u.commercialSubtypes : [];
            return (
              <tr
                key={u.id}
                onClick={() => setDetailUserId(u.id)}
                style={{ cursor: "pointer" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#fff7ed";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "";
                }}
              >
                <td style={{ fontWeight: 700 }}>{u.name || "—"}</td>
                <td>{u.phone}</td>
                <td>{accountTypeLabelTr(u.accountType)}</td>
                <td style={{ fontSize: 12, color: "#475569" }}>
                  {isCorporateAccount(u.accountType)
                    ? subs.length
                      ? subs
                          .map(
                            (s) =>
                              businessTypes.find((t) => t.key === s)?.label ||
                              commercialSubtypeLabelTr(s)
                          )
                          .join(", ")
                      : "—"
                    : "—"}
                </td>
                <td>{u.role}</td>
                <td>{u.tokenBalance}</td>
                <td>{u.isActive ? "Aktif" : "Pasif"}</td>
                <td>
                  <button
                    className="btn-outline"
                    style={{ padding: "6px 10px" }}
                    onClick={async (e) => {
                      e.stopPropagation();
                      await fetch("/api/admin", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "toggle-user",
                          userId: u.id,
                          isActive: !u.isActive,
                        }),
                      });
                      load();
                    }}
                  >
                    {u.isActive ? "Pasifleştir" : "Aktifleştir"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {detailUserId && (
        <AdminUserDetailModal
          userId={detailUserId}
          onClose={() => setDetailUserId(null)}
          onToggled={() => load()}
        />
      )}
    </div>
  );
}

function splitRemaining(endsAt?: string | Date | null) {
  if (!endsAt) return { days: 0, hours: 0, minutes: 0, expired: true };
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, expired: true };
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  return { days, hours, minutes, expired: false };
}

function AdminListingDurationModal({
  listing,
  onClose,
  onSaved,
}: {
  listing: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const initial = splitRemaining(listing.endsAt);
  const [days, setDays] = useState(initial.days);
  const [hours, setHours] = useState(initial.hours);
  const [minutes, setMinutes] = useState(initial.minutes);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { alert } = useDialog();

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const live = useMemo(() => splitRemaining(listing.endsAt), [listing.endsAt, tick]);

  async function save() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "set-listing-duration",
        listingId: listing.id,
        days,
        hours,
        minutes,
      }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(d.error || "Süre güncellenemedi");
      return;
    }
    await alert({
      title: "Süre güncellendi",
      message: "İlan bitiş süresi yeni değere ayarlandı.",
      tone: "success",
    });
    onSaved();
  }

  return (
    <div className="tb-dialog-backdrop" onClick={onClose}>
      <div
        className="tb-dialog"
        style={{ textAlign: "left", width: "min(460px, 100%)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="tb-dialog-close" onClick={onClose} aria-label="Kapat">
          ×
        </button>
        <h3 className="tb-dialog-title" style={{ textAlign: "left", paddingRight: 28 }}>
          İlan süresi
        </h3>
        <p className="tb-dialog-message" style={{ textAlign: "left", marginBottom: 10 }}>
          <strong>{listing.title}</strong>
        </p>

        <div
          style={{
            background: "linear-gradient(145deg, #0b1f3a, #16345c)",
            color: "#fff",
            borderRadius: 14,
            padding: "16px 18px",
            marginBottom: 16,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 4 }}>Kalan süre (canlı)</div>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.02em" }}>
            {live.expired
              ? "Süre doldu"
              : `${live.days}g ${String(live.hours).padStart(2, "0")}sa ${String(live.minutes).padStart(2, "0")}dk`}
          </div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
            Bitiş:{" "}
            {listing.endsAt
              ? new Date(listing.endsAt).toLocaleString("tr-TR")
              : "Tanımlı değil"}
          </div>
        </div>

        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Yeni kalan süre</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
          <label style={{ display: "grid", gap: 4, fontSize: 12, color: "var(--muted)" }}>
            Gün
            <input
              className="input"
              type="number"
              min={0}
              value={days}
              onChange={(e) => setDays(Math.max(0, Number(e.target.value) || 0))}
            />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 12, color: "var(--muted)" }}>
            Saat
            <input
              className="input"
              type="number"
              min={0}
              max={23}
              value={hours}
              onChange={(e) => setHours(Math.max(0, Number(e.target.value) || 0))}
            />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 12, color: "var(--muted)" }}>
            Dakika
            <input
              className="input"
              type="number"
              min={0}
              max={59}
              value={minutes}
              onChange={(e) => setMinutes(Math.max(0, Number(e.target.value) || 0))}
            />
          </label>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {[
            { label: "1 saat", d: 0, h: 1, m: 0 },
            { label: "6 saat", d: 0, h: 6, m: 0 },
            { label: "1 gün", d: 1, h: 0, m: 0 },
            { label: "3 gün", d: 3, h: 0, m: 0 },
            { label: "7 gün", d: 7, h: 0, m: 0 },
          ].map((p) => (
            <button
              key={p.label}
              type="button"
              className="btn-outline"
              style={{ padding: "6px 10px", fontSize: 12 }}
              onClick={() => {
                setDays(p.d);
                setHours(p.h);
                setMinutes(p.m);
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ color: "#dc2626", fontWeight: 600, fontSize: 13, marginBottom: 10 }}>{error}</div>
        )}

        <div className="tb-dialog-actions" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="tb-dialog-btn tb-dialog-btn-ghost" disabled={busy} onClick={onClose}>
            Vazgeç
          </button>
          <button
            type="button"
            className="tb-dialog-btn tb-dialog-btn-primary"
            disabled={busy}
            onClick={save}
          >
            {busy ? "Kaydediliyor..." : "Süreyi Uygula"}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatAdminDate(value?: string | Date | null) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AdminListingDetailModal({
  listing,
  onClose,
}: {
  listing: any;
  onClose: () => void;
}) {
  const [feeOpen, setFeeOpen] = useState(false);
  const publishAt = listing.startsAt || listing.reviewedAt || listing.createdAt;
  const rating = listing.sellerRating;
  const feePaid = Number(listing.feePaidTl || 0) > 0;
  const feePayment = listing.feePayment || null;
  const feeRows = feePayment
    ? paymentMetaDetails({
        id: feePayment.id,
        purpose: feePayment.purpose,
        amountTl: feePayment.amountTl,
        status: feePayment.status,
        createdAt: feePayment.createdAt,
        user: listing.seller,
        meta: feePayment.meta,
      })
    : [];
  const premiumBits = [
    listing.titleBold ? "Kalın başlık" : null,
    listing.titleLarge ? "Büyük harf" : null,
    listing.isColored ? "Renkli" : null,
    listing.isFeatured || Number(listing.featuredDays || 0) > 0
      ? `Öne çıkan${listing.featuredDays ? ` (${listing.featuredDays}g)` : ""}`
      : null,
  ].filter(Boolean) as string[];

  return (
    <div className="adm-listing-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="adm-listing-modal"
        role="dialog"
        aria-modal="true"
        aria-label="İlan detayı"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="adm-listing-modal-close" onClick={onClose} aria-label="Kapat">
          <X size={18} />
        </button>

        <div className="adm-listing-modal-hero">
          {listing.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={listing.coverImage} alt="" />
          ) : (
            <div className="adm-listing-modal-hero-empty">Kapak yok</div>
          )}
          <div className="adm-listing-modal-hero-text">
            <div className="adm-listing-modal-no">{formatListingNo(listing.listingNo)}</div>
            <h2>{listing.title}</h2>
            <p>
              {listing.city}
              {listing.district ? ` / ${listing.district}` : ""}
              {listing.category?.name ? ` · ${listing.category.name}` : ""}
            </p>
          </div>
        </div>

        <div className="adm-listing-modal-grid">
          <div className="adm-listing-modal-item">
            <span>Durum</span>
            <strong>{listingStatusLabel(listing.status)}</strong>
          </div>
          <div className="adm-listing-modal-item">
            <span>Kalan süre</span>
            <strong>{remainingLabel(listing.endsAt)}</strong>
          </div>
          <div className="adm-listing-modal-item">
            <span>Yayın tarihi</span>
            <strong>{formatAdminDate(publishAt)}</strong>
          </div>
          <div className="adm-listing-modal-item">
            <span>Onaylayan</span>
            <strong>
              {listing.reviewedBy?.name || listing.reviewedBy?.phone || (listing.reviewedAt ? "—" : "Henüz onaylanmadı")}
            </strong>
          </div>
          <div className="adm-listing-modal-item">
            <span>Onay tarihi</span>
            <strong>{formatAdminDate(listing.reviewedAt)}</strong>
          </div>
          <div className="adm-listing-modal-item">
            <span>Satıcı</span>
            <strong>{listing.seller?.name || listing.seller?.phone || "—"}</strong>
          </div>
          <div className="adm-listing-modal-item">
            <span>Mağaza</span>
            <strong>{listing.shop?.name || "—"}</strong>
          </div>
          <div className="adm-listing-modal-item">
            <span>Satıcı puanı</span>
            <strong>
              {rating?.avg != null
                ? `${rating.avg} / 5 (${rating.count} yorum)`
                : "Henüz puan yok"}
            </strong>
          </div>
          <div className="adm-listing-modal-item">
            <span>Mağaza paketi</span>
            <strong>{listing.shopPackageName || "—"}</strong>
          </div>
          <button
            type="button"
            className={`adm-listing-modal-item adm-listing-modal-item--btn${feePaid ? " is-clickable" : ""}`}
            disabled={!feePaid || !feePayment}
            title={feePaid ? "Ücret detayını göster" : undefined}
            onClick={() => feePaid && feePayment && setFeeOpen((v) => !v)}
          >
            <span>İlan ücreti{feePaid ? (feeOpen ? " · gizle" : " · detay") : ""}</span>
            <strong style={{ color: feePaid ? "#059669" : undefined }}>
              {feePaid ? formatTl(listing.feePaidTl) : "Ücretsiz / yok"}
            </strong>
          </button>
          <div className="adm-listing-modal-item">
            <span>Fiyat</span>
            <strong>{formatTl(listing.askPrice)}</strong>
          </div>
          <div className="adm-listing-modal-item">
            <span>En yüksek teklif</span>
            <strong>{listing.highestBid ? formatTl(listing.highestBid) : "—"}</strong>
          </div>
        </div>

        {feeOpen && feePayment && (
          <div className="adm-listing-fee-detail">
            <div className="adm-listing-fee-detail-head">Ücret detayı</div>
            <div className="adm-listing-fee-detail-rows">
              {feeRows.map((row) => (
                <div key={row.label} className="adm-listing-fee-detail-row">
                  <span>{row.label}</span>
                  {row.href ? (
                    <Link href={row.href} target="_blank" rel="noreferrer">
                      {row.value}
                    </Link>
                  ) : (
                    <strong>{row.value}</strong>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {premiumBits.length > 0 && (
          <div className="adm-listing-modal-premium">
            <Star size={14} fill="#f59e0b" color="#f59e0b" />
            <span>Premium / ücretli özellikler: {premiumBits.join(" · ")}</span>
          </div>
        )}

        <div className="adm-listing-modal-actions">
          <Link href={`/ilan/${listing.id}`} className="btn-orange" style={{ padding: "10px 14px" }}>
            İlana git
          </Link>
          <button type="button" className="btn-outline" style={{ padding: "10px 14px" }} onClick={onClose}>
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminListingsPanel({ vertical }: { vertical?: AdminVertical } = {}) {
  const { data, load, filters, applyFilters } = useAdminData(vertical);
  const { confirm, alert } = useDialog();
  const [durationFor, setDurationFor] = useState<any | null>(null);
  const [detailFor, setDetailFor] = useState<any | null>(null);
  const q = useDebouncedFilter(applyFilters, "listingQ");

  if (!data) return <div className="adm-card">Yükleniyor...</div>;

  async function removeListing(l: any, e?: MouseEvent) {
    e?.stopPropagation();
    if (l.status === "APPROVED") {
      await alert({
        title: "Silinemez",
        message: "Sonuçlanan ilanlar silinemez.",
        tone: "warning",
      });
      return;
    }
    const ok = await confirm({
      title: "İlanı sil",
      message: `"${l.title}" kalıcı olarak silinsin mi? Bu işlem geri alınamaz.`,
      confirmLabel: "Sil",
      cancelLabel: "Vazgeç",
      tone: "danger",
    });
    if (!ok) return;
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete-listing", listingId: l.id }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      await alert({ title: "Silinemedi", message: j.error || "İlan silinemedi", tone: "danger" });
      return;
    }
    load();
  }

  return (
    <div className="adm-card" style={{ overflow: "auto" }}>
      <AdminFilterBar resultCount={(data.listings || []).length}>
        <FilterInput
          placeholder="Başlık, no, satıcı ara…"
          value={q.value}
          onChange={(e) => q.onChange(e.target.value)}
        />
        <FilterSelect
          value={filters.listingStatus || ""}
          onChange={(e) => applyFilters({ listingStatus: e.target.value })}
        >
          <option value="">Tüm durumlar</option>
          {LISTING_STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          value={filters.listingEnding || ""}
          onChange={(e) => applyFilters({ listingEnding: e.target.value })}
        >
          <option value="">Süre: tümü</option>
          <option value="ending_soon">Az kalan (&lt;24 saat)</option>
          <option value="live">Süresi devam eden</option>
          <option value="expired">Süresi dolmuş</option>
        </FilterSelect>
        {(filters.listingQ || filters.listingStatus || filters.listingEnding) && (
          <button
            type="button"
            className="btn-outline"
            style={{ padding: "6px 10px", fontSize: 12 }}
            onClick={() => {
              q.setValue("");
              load({});
            }}
          >
            Temizle
          </button>
        )}
      </AdminFilterBar>
      <table className="adm-table adm-table--compact adm-listings-table">
        <thead>
          <tr>
            <th>No</th>
            <th>Kapak</th>
            <th>Başlık</th>
            <th>Satıcı</th>
            <th>Mağaza</th>
            <th>Fiyat</th>
            <th>Teklif</th>
            <th>Durum</th>
            <th>Yayın</th>
            <th>Süre</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {(data.listings || []).length === 0 && (
            <tr>
              <td colSpan={11} style={{ color: "var(--adm-muted)" }}>
                Filtreye uyan ilan yok.
              </td>
            </tr>
          )}
          {data.listings.map((l: any) => {
            const publishAt = l.startsAt || l.reviewedAt || l.createdAt;
            return (
              <tr
                key={l.id}
                className="adm-listings-row"
                onClick={() => setDetailFor(l)}
                title="Detay için tıklayın"
              >
                <td style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, whiteSpace: "nowrap" }}>
                  {formatListingNo(l.listingNo)}
                </td>
                <td>
                  <div className="adm-listing-thumb">
                    {l.coverImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.coverImage} alt="" />
                    ) : (
                      <span />
                    )}
                  </div>
                </td>
                <td className="adm-listing-title-cell">
                  <span className="adm-listing-title">{l.title}</span>
                </td>
                <td style={{ fontSize: 12 }}>{l.seller?.name || l.seller?.phone || "—"}</td>
                <td style={{ fontSize: 12, color: l.shop?.name ? "#0f172a" : "#94a3b8" }}>
                  {l.shop?.name || "—"}
                </td>
                <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>{formatTl(l.askPrice)}</td>
                <td style={{ color: "var(--adm-green)", fontWeight: 700, fontSize: 12 }}>
                  {l.highestBid ? formatTl(l.highestBid) : "—"}
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <select
                    className="select adm-listing-status"
                    value={l.status}
                    onChange={async (e) => {
                      await fetch("/api/admin", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "set-listing-status",
                          listingId: l.id,
                          status: e.target.value,
                        }),
                      });
                      load();
                    }}
                  >
                    {LISTING_STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td style={{ fontSize: 11, whiteSpace: "nowrap", color: "#64748b" }}>
                  {formatAdminDate(publishAt)}
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="btn-outline adm-listing-duration-btn"
                    onClick={() => setDurationFor(l)}
                    title="İlan süresini düzenle"
                  >
                    {remainingLabel(l.endsAt)}
                  </button>
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="adm-listing-actions">
                    <Link
                      href={`/ilan/${l.id}`}
                      className="btn-outline adm-listing-ico-btn"
                      title="İlana git"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink size={13} />
                    </Link>
                    <button
                      type="button"
                      className="btn-outline adm-listing-ico-btn"
                      style={{ color: "#b91c1c" }}
                      disabled={l.status === "APPROVED"}
                      title={l.status === "APPROVED" ? "Sonuçlanan ilanlar silinemez" : "Sil"}
                      onClick={(e) => removeListing(l, e)}
                    >
                      Sil
                    </button>
                    {l.hasPaidOrPremium ? (
                      <span className="adm-listing-star" title="Ödeme veya premium özellik var">
                        <Star size={14} fill="#f59e0b" color="#d97706" />
                      </span>
                    ) : (
                      <span className="adm-listing-star-slot" aria-hidden />
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {durationFor && (
        <AdminListingDurationModal
          listing={durationFor}
          onClose={() => setDurationFor(null)}
          onSaved={() => {
            setDurationFor(null);
            load();
          }}
        />
      )}
      {detailFor && <AdminListingDetailModal listing={detailFor} onClose={() => setDetailFor(null)} />}
    </div>
  );
}

export function AdminTokensPanel() {
  const { data, popup, setPopup, load, setMsg, msg } = useAdminData();
  const [quickEnabled, setQuickEnabled] = useState(true);
  const [quickPresets, setQuickPresets] = useState("1, 5, 10, 25, 50, 100");
  const [quickMax, setQuickMax] = useState(10000);
  const [quickPrice, setQuickPrice] = useState(0);
  const [savingQuick, setSavingQuick] = useState(false);

  useEffect(() => {
    if (!data?.settings) return;
    setQuickEnabled(Boolean(data.settings.quick_token_enabled ?? true));
    const presets = data.settings.quick_token_presets;
    setQuickPresets(Array.isArray(presets) ? presets.join(", ") : "1, 5, 10, 25, 50, 100");
    setQuickMax(Number(data.settings.quick_token_max ?? 10000));
    setQuickPrice(Number(data.settings.quick_token_price_per_token_tl ?? 0));
  }, [data]);

  if (!data) return <div className="adm-card">Yükleniyor...</div>;

  async function saveQuick() {
    setSavingQuick(true);
    try {
      const presets = quickPresets
        .split(/[,;\s]+/)
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n > 0);
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-settings",
          settings: {
            ...data.settings,
            quick_token_enabled: quickEnabled,
            quick_token_presets: presets.length ? presets : [1, 5, 10, 25, 50, 100],
            quick_token_max: quickMax,
            quick_token_price_per_token_tl: quickPrice,
          },
        }),
      });
      if (!res.ok) {
        setMsg("Hızlı jeton ayarı kaydedilemedi");
        return;
      }
      setMsg("Hızlı jeton ayarları kaydedildi");
      await load();
    } finally {
      setSavingQuick(false);
    }
  }

  return (
    <div className="adm-panel-wrap">
      <AdminToast
        message={msg || null}
        tone={msg && /başarısız|edilmedi|hata/i.test(msg) ? "err" : "ok"}
        onClose={() => setMsg("")}
      />
      <div className="adm-card">
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Hızlı Jeton Al</h2>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--adm-muted)", lineHeight: 1.45 }}>
          Kapalıysa /jeton sayfasında ve teklif modalında yalnızca paketler görünür. Açıkken hızlı butonlar ve özel
          miktar alanı da sunulur; fiyatı buradan belirlersiniz.
        </p>
        <div style={{ display: "grid", gap: 12, maxWidth: 520 }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 10, fontWeight: 700 }}>
            <input type="checkbox" checked={quickEnabled} onChange={(e) => setQuickEnabled(e.target.checked)} />
            Hızlı jeton {quickEnabled ? "açık" : "kapalı"}
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Hızlı miktarlar (virgülle)</span>
            <input className="input" value={quickPresets} onChange={(e) => setQuickPresets(e.target.value)} disabled={!quickEnabled} />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Üst limit (jeton)</span>
              <input
                className="input"
                type="number"
                value={quickMax}
                onChange={(e) => setQuickMax(Number(e.target.value))}
                disabled={!quickEnabled}
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Birim fiyat (TL / jeton)</span>
              <input
                className="input"
                type="number"
                value={quickPrice}
                onChange={(e) => setQuickPrice(Number(e.target.value))}
                disabled={!quickEnabled}
              />
            </label>
          </div>
          <button className="btn-orange" style={{ padding: 12, width: 200 }} disabled={savingQuick} onClick={saveQuick}>
            Hızlı Jeton Ayarını Kaydet
          </button>
        </div>
      </div>

      <button className="btn-orange" style={{ width: 200, padding: 10 }} onClick={() => setPopup({ type: "token" })}>
        + Paket Ekle
      </button>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12 }}>
        {data.packages.map((p: any) => (
          <div key={p.id} className="adm-card">
            <div style={{ fontWeight: 800 }}>{p.name}</div>
            <div style={{ fontSize: 28, fontWeight: 900, margin: "8px 0" }}>{p.tokenAmount} jeton</div>
            <div style={{ color: "var(--adm-muted)" }}>{formatTl(p.priceTl)}</div>
            {Number(p.discountPercent) > 0 && (
              <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: "#dc2626" }}>
                %{p.discountPercent} avantaj
              </div>
            )}
            <button className="btn-outline" style={{ marginTop: 10, padding: 8 }} onClick={() => setPopup({ type: "token", payload: p })}>
              Düzenle
            </button>
          </div>
        ))}
      </div>
      {popup?.type === "token" && (
        <div className="modal-backdrop" onClick={() => setPopup(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <TokenForm
              initial={popup.payload}
              onClose={() => setPopup(null)}
              onSaved={() => {
                setPopup(null);
                load();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminShopsPanel() {
  const { data, popup, setPopup, load } = useAdminData();
  if (!data) return <div className="adm-card">Yükleniyor...</div>;
  return (
    <div className="adm-panel-wrap">
      <button className="btn-orange" style={{ width: 220, padding: 10 }} onClick={() => setPopup({ type: "shop" })}>
        + İlan Paketi
      </button>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12 }}>
        {data.shopPackages.map((p: any) => {
          const bt = String(p.billingType || "").toUpperCase();
          const daily = bt === "DAILY";
          const yearly = bt === "YEARLY" || bt === "ANNUAL" || bt === "YEAR";
          const unit = daily ? "/ gün" : yearly ? "/ yıl" : "/ ay";
          const kind = daily ? "Günlük" : yearly ? "Yıllık" : "Aylık";
          return (
            <div key={p.id} className="adm-card">
              <div style={{ fontWeight: 800 }}>{p.name}</div>
              <div style={{ fontSize: 13, color: "var(--adm-muted)" }}>
                {p.accountType === "BIREYSEL_TICARI" || p.accountType === "BIREYSEL" ? "Bireysel" : "Kurumsal"} ·{" "}
                {kind}
              </div>
              <div style={{ marginTop: 8 }}>
                {p.listingLimit} ilan hakkı
                {daily ? ` · ${p.minDays || 1}–${p.maxDays || 30} gün seçilebilir` : " / dönem"}
              </div>
              {Number(p.premiumDiscountPercent) > 0 ? (
                <div style={{ marginTop: 4, fontSize: 13, fontWeight: 800, color: "#c2410c" }}>
                  Premium özelliklerde %{p.premiumDiscountPercent} indirim
                </div>
              ) : null}
              <div style={{ fontWeight: 900, fontSize: 22 }}>
                {formatTl(p.monthlyPrice)} {unit}
              </div>
              {p.tokenPrice != null && Number(p.tokenPrice) > 0 ? (
                <div style={{ marginTop: 4, fontSize: 13, fontWeight: 800, color: "#c2410c" }}>
                  {Number(p.tokenPrice)} jeton {unit}
                </div>
              ) : null}
              <button className="btn-outline" style={{ marginTop: 10, padding: 8 }} onClick={() => setPopup({ type: "shop", payload: p })}>
                Düzenle
              </button>
            </div>
          );
        })}
      </div>
      {popup?.type === "shop" && (
        <div className="modal-backdrop" onClick={() => setPopup(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <ShopForm
              initial={popup.payload}
              onClose={() => setPopup(null)}
              onSaved={() => {
                setPopup(null);
                load();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminCategoriesPanel({ vertical }: { vertical?: AdminVertical } = {}) {
  const { data, load } = useAdminData(vertical);
  const { confirm, alert } = useDialog();
  const [form, setForm] = useState({ id: "", name: "", slug: "", icon: "grid", sortOrder: 0, isActive: true });
  const [q, setQ] = useState("");

  const query = q.trim().toLocaleLowerCase("tr-TR");
  const categories = useMemo(() => {
    let list = Array.isArray(data?.categories) ? [...data.categories] : [];
    if (vertical) {
      list = list.filter((c: { slug?: string; isPremium?: boolean }) =>
        categoryMatchesVertical(c, vertical)
      );
    }
    if (!query) {
      return list.sort(
        (a: { sortOrder?: number }, b: { sortOrder?: number }) => (a.sortOrder || 0) - (b.sortOrder || 0)
      );
    }
    const scored = list.map((c: { name?: string; slug?: string; sortOrder?: number }) => {
      const name = String(c.name || "").toLocaleLowerCase("tr-TR");
      const slug = String(c.slug || "").toLocaleLowerCase("tr-TR");
      let score = 0;
      if (name === query || slug === query) score = 100;
      else if (name.startsWith(query) || slug.startsWith(query)) score = 80;
      else if (name.includes(query) || slug.includes(query)) score = 50;
      return { c, score };
    });
    return scored
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || (a.c.sortOrder || 0) - (b.c.sortOrder || 0))
      .map((x) => x.c);
  }, [data?.categories, query, vertical]);

  if (!data) return <div className="adm-card">Yükleniyor...</div>;

  async function save() {
    await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save-category", ...form, id: form.id || undefined }),
    });
    setForm({ id: "", name: "", slug: "", icon: "grid", sortOrder: 0, isActive: true });
    load();
  }

  async function removeCategory(c: { id: string; name: string }) {
    const ok = await confirm({
      title: "Kategoriyi sil",
      message: `"${c.name}" kategorisi silinsin mi? Bu işlem geri alınamaz.`,
      confirmLabel: "Sil",
      cancelLabel: "Vazgeç",
      tone: "danger",
    });
    if (!ok) return;
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete-category", id: c.id }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      await alert({ title: "Silinemedi", message: j.error || "Kategori silinemedi", tone: "danger" });
      return;
    }
    load();
  }

  return (
    <div className="adm-panel-wrap">
      <div className="adm-card" style={{ padding: 12 }}>
        <input
          className="input"
          placeholder="Kategori ara (ad veya slug)…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoComplete="off"
          style={{ width: "100%", fontSize: 14 }}
        />
        {query ? (
          <div style={{ marginTop: 8, fontSize: 12.5, color: "#64748b", fontWeight: 600 }}>
            {categories.length} sonuç · en iyi eşleşmeler üstte
          </div>
        ) : null}
      </div>
      <div className="adm-card" style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(5,minmax(0,1fr)) auto" }}>
        <input className="input" placeholder="Ad" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: form.id ? form.slug : e.target.value.toLowerCase().replace(/[^a-z0-9ğüşıöç]+/gi, "-") })} />
        <input className="input" placeholder="Slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
        <input className="input" placeholder="İkon" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
        <input className="input" type="number" placeholder="Sıra" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Aktif
        </label>
        <button className="btn-orange" style={{ padding: "10px 14px" }} onClick={save}>
          {form.id ? "Güncelle" : "Ekle"}
        </button>
      </div>
      <div className="adm-card" style={{ overflow: "auto" }}>
        <table className="adm-table">
          <thead>
            <tr>
              <th>Ad</th>
              <th>Slug</th>
              <th>İlan</th>
              <th>Sıra</th>
              <th>Durum</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c: any) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.slug}</td>
                <td>{c._count?.listings ?? 0}</td>
                <td>{c.sortOrder}</td>
                <td>{c.isActive ? "Aktif" : "Pasif"}</td>
                <td style={{ display: "flex", gap: 6 }}>
                  <button className="btn-outline" style={{ padding: "6px 10px" }} onClick={() => setForm({ id: c.id, name: c.name, slug: c.slug, icon: c.icon || "grid", sortOrder: c.sortOrder, isActive: c.isActive })}>
                    Düzenle
                  </button>
                  <button
                    className="btn-outline"
                    style={{ padding: "6px 10px" }}
                    onClick={() => removeCategory(c)}
                  >
                    Sil
                  </button>
                </td>
              </tr>
            ))}
            {query && !categories.length ? (
              <tr>
                <td colSpan={6} style={{ padding: 16, color: "#64748b" }}>
                  Eşleşen kategori yok.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminBidsPanel({ vertical }: { vertical?: AdminVertical } = {}) {
  // Teklif = ilana bid/offer; dikey prop ile yalnızca o dikeyin ilanlarındaki teklifler gelir
  const { data, load, filters, applyFilters } = useAdminData(vertical);
  const q = useDebouncedFilter(applyFilters, "bidQ");
  if (!data) return <div className="adm-card">Yükleniyor...</div>;
  return (
    <div className="adm-card" style={{ overflow: "auto" }}>
      <AdminFilterBar resultCount={(data.bids || []).length}>
        <FilterInput
          placeholder="İlan veya teklifçi ara…"
          value={q.value}
          onChange={(e) => q.onChange(e.target.value)}
        />
        <FilterSelect
          value={filters.bidStatus || ""}
          onChange={(e) => applyFilters({ bidStatus: e.target.value })}
        >
          <option value="">Tüm durumlar</option>
          {BID_STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </FilterSelect>
        {(filters.bidQ || filters.bidStatus) && (
          <button
            type="button"
            className="btn-outline"
            style={{ padding: "8px 12px", fontSize: 13 }}
            onClick={() => {
              q.setValue("");
              load({});
            }}
          >
            Temizle
          </button>
        )}
      </AdminFilterBar>
      <table className="adm-table adm-table--compact adm-listings-table">
        <thead>
          <tr>
            <th>Yayın</th>
            <th>İlan</th>
            <th>Teklifçi</th>
            <th>İlan fiyatı</th>
            <th>Önceki teklif</th>
            <th>Teklif</th>
            <th>Durum</th>
            <th>Teklif tarihi</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {(data.bids || []).length === 0 && (
            <tr>
              <td colSpan={9} style={{ color: "var(--adm-muted)" }}>
                Filtreye uyan teklif yok.
              </td>
            </tr>
          )}
          {(data.bids || []).map((b: any) => {
            const prev = b.previousAmount != null ? Number(b.previousAmount) : null;
            const publishAt =
              b.listing?.startsAt || b.listing?.reviewedAt || b.listing?.createdAt || null;
            const endsAt = b.listing?.endsAt || null;
            return (
            <tr key={b.id} className="adm-listings-row">
              <td style={{ fontSize: 11, whiteSpace: "nowrap" }}>
                <div style={{ color: "#64748b" }}>
                  {publishAt
                    ? new Date(publishAt).toLocaleString("tr-TR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </div>
                <div
                  style={{
                    marginTop: 2,
                    fontWeight: 700,
                    color: endsAt && new Date(endsAt).getTime() < Date.now() ? "#b91c1c" : "#0f766e",
                  }}
                >
                  {remainingLabel(endsAt)}
                </div>
              </td>
              <td>
                <Link
                  href={`/ilan/${b.listing?.id}`}
                  style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}
                >
                  {b.listing?.title}
                </Link>
              </td>
              <td style={{ fontSize: 12.5 }}>{b.bidder?.name || b.bidder?.phone}</td>
              <td style={{ fontSize: 12.5, whiteSpace: "nowrap", fontWeight: 650 }}>
                {formatTl(b.listing?.askPrice)}
              </td>
              <td
                style={{
                  fontSize: 12.5,
                  whiteSpace: "nowrap",
                  fontWeight: 700,
                  color: prev != null && prev > 0 ? "#dc2626" : "#94a3b8",
                }}
              >
                {prev != null && prev > 0 ? formatTl(prev) : "—"}
              </td>
              <td style={{ color: "var(--adm-green)", fontWeight: 700, fontSize: 12.5, whiteSpace: "nowrap" }}>
                {formatTl(b.amount)}
              </td>
              <td style={{ fontSize: 12.5 }}>{bidStatusLabel(b.status)}</td>
              <td style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>
                {new Date(b.createdAt).toLocaleString("tr-TR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </td>
              <td onClick={(e) => e.stopPropagation()}>
                <select
                  className="select"
                  style={{ width: 130, padding: "4px 6px", fontSize: 12, height: 28, minHeight: 28 }}
                  value={b.status}
                  onChange={async (e) => {
                    await fetch("/api/admin", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "set-bid-status", bidId: b.id, status: e.target.value }),
                    });
                    load();
                  }}
                >
                  {BID_STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function AdminPaymentsPanel() {
  const { data, load, filters, applyFilters } = useAdminData();
  const { alert, confirm } = useDialog();
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const q = useDebouncedFilter(applyFilters, "paymentQ");

  async function deleteSelectedPayment() {
    if (!selectedPayment?.id || deleteBusy) return;
    setDeleteBusy(true);
    try {
      const previewRes = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview-payment-delete", paymentId: selectedPayment.id }),
      });
      const preview = await previewRes.json().catch(() => ({}));
      if (!previewRes.ok) {
        await alert({
          title: "Silinemedi",
          message: preview.error || "Ödeme önizlemesi alınamadı.",
          tone: "danger",
        });
        return;
      }
      const effectLines = Array.isArray(preview.effects)
        ? preview.effects.map((e: { label?: string }) => `• ${e.label || ""}`).join("\n")
        : "";
      const related = Array.isArray(preview.effects)
        ? preview.effects.filter((e: { kind?: string }) => e.kind && e.kind !== "payment")
        : [];
      const message = related.length
        ? `Bu ödemeye bağlı başka işlemler var. Silmek istediğinizden emin misiniz?\n\n${effectLines}\n\nBu işlem geri alınamaz.`
        : `Ödeme kaydını silmek istediğinizden emin misiniz?\n\n${effectLines}\n\nBu işlem geri alınamaz.`;
      const ok = await confirm({
        title: "Ödemeyi sil",
        message,
        confirmLabel: "Evet, sil",
        cancelLabel: "Vazgeç",
        tone: "danger",
      });
      if (!ok) return;

      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete-payment", paymentId: selectedPayment.id }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        await alert({ title: "Silinemedi", message: j.error || "Ödeme silinemedi.", tone: "danger" });
        return;
      }
      setSelectedPayment(null);
      await load();
    } finally {
      setDeleteBusy(false);
    }
  }

  if (!data) return <div className="adm-card">Yükleniyor...</div>;

  return (
    <div className="adm-panel-wrap">
      <div className="adm-card" style={{ overflow: "auto" }}>
        <AdminFilterBar resultCount={(data.payments || []).length}>
          <FilterInput
            placeholder="Kullanıcı veya amaç ara…"
            value={q.value}
            onChange={(e) => q.onChange(e.target.value)}
          />
          <FilterSelect
            value={filters.paymentStatus || ""}
            onChange={(e) => applyFilters({ paymentStatus: e.target.value })}
          >
            <option value="">Tüm durumlar</option>
            <option value="PENDING">Bekliyor</option>
            <option value="PAID">Ödendi</option>
            <option value="SIMULATED">Simüle</option>
            <option value="FAILED">Başarısız</option>
            <option value="CANCELLED">İptal</option>
          </FilterSelect>
          <FilterSelect
            value={filters.paymentPurpose || ""}
            onChange={(e) => applyFilters({ paymentPurpose: e.target.value })}
          >
            <option value="">Tüm amaçlar</option>
            <option value="listing_fee">İlan ücreti</option>
            <option value="token">Jeton</option>
            <option value="shop_subscription">Kurumsal paket</option>
            <option value="manual">Manuel</option>
          </FilterSelect>
          {(filters.paymentQ || filters.paymentStatus || filters.paymentPurpose) && (
            <button
              type="button"
              className="btn-outline"
              style={{ padding: "8px 12px", fontSize: 13 }}
              onClick={() => {
                q.setValue("");
                load({});
              }}
            >
              Temizle
            </button>
          )}
        </AdminFilterBar>
        <div style={{ fontSize: 12.5, color: "var(--adm-muted)", marginBottom: 8 }}>
          Satıra tıklayınca ödeme detayı açılır (ilan, jeton, paket vb.). POS / jeton ve simülasyon: Ödemeler →
          Altyapı.
        </div>
        <table className="adm-table">
          <thead>
            <tr>
              <th>Kullanıcı</th>
              <th>Amaç</th>
              <th>Tutar</th>
              <th>KDV</th>
              <th>Durum</th>
              <th>Tarih</th>
            </tr>
          </thead>
          <tbody>
            {(data.payments || []).length === 0 && (
              <tr>
                <td colSpan={6} style={{ color: "var(--adm-muted)" }}>
                  Filtreye uyan ödeme yok.
                </td>
              </tr>
            )}
            {(data.payments || []).map((p: any) => (
              <tr
                key={p.id}
                onClick={() => setSelectedPayment(p)}
                style={{ cursor: "pointer" }}
                title="Detayı gör"
              >
                <td>{p.user?.name || p.user?.phone}</td>
                <td>{paymentPurposeLabel(p.purpose)}</td>
                <td>{formatTl(p.amountTl)}</td>
                <td style={{ fontWeight: 700, color: "#0369a1" }}>
                  {formatTl(extractPaymentVatTl(p.meta, p.amountTl))}
                </td>
                <td>{paymentStatusLabel(p.status)}</td>
                <td>{new Date(p.createdAt).toLocaleString("tr-TR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedPayment && (
        <div className="modal-backdrop" onClick={() => setSelectedPayment(null)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 520, width: "min(520px, 94vw)", display: "grid", gap: 12 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>Ödeme detayı</h3>
              <button type="button" className="btn-outline" style={{ padding: "6px 10px" }} onClick={() => setSelectedPayment(null)}>
                Kapat
              </button>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {paymentMetaDetails(selectedPayment).map((row) => (
                <div
                  key={row.label}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "140px 1fr",
                    gap: 10,
                    fontSize: 13,
                    paddingBottom: 8,
                    borderBottom: "1px solid #eef2f7",
                  }}
                >
                  <span style={{ color: "#64748b", fontWeight: 700 }}>{row.label}</span>
                  {row.href ? (
                    <Link href={row.href} target="_blank" style={{ fontWeight: 700, wordBreak: "break-all" }}>
                      {row.value} ↗
                    </Link>
                  ) : (
                    <span style={{ fontWeight: 700, wordBreak: "break-word" }}>{row.value}</span>
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
              <button
                type="button"
                className="btn-outline"
                style={{ padding: "8px 14px", color: "#b91c1c", borderColor: "#fecaca", fontWeight: 800 }}
                disabled={deleteBusy}
                onClick={deleteSelectedPayment}
              >
                {deleteBusy ? "…" : "Ödemeyi sil"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminMessagesPanel() {
  const { data, load, filters, applyFilters } = useAdminData();
  const q = useDebouncedFilter(applyFilters, "messageQ");
  if (!data) return <div className="adm-card">Yükleniyor...</div>;
  return (
    <div className="adm-card" style={{ overflow: "auto" }}>
      <AdminFilterBar resultCount={(data.messages || []).length}>
        <FilterInput
          placeholder="Mesaj, kişi veya ilan ara…"
          value={q.value}
          onChange={(e) => q.onChange(e.target.value)}
        />
        <FilterSelect
          value={filters.messageUnread || ""}
          onChange={(e) => applyFilters({ messageUnread: e.target.value })}
        >
          <option value="">Tümü</option>
          <option value="1">Sadece okunmamış</option>
        </FilterSelect>
        {(filters.messageQ || filters.messageUnread) && (
          <button
            type="button"
            className="btn-outline"
            style={{ padding: "8px 12px", fontSize: 13 }}
            onClick={() => {
              q.setValue("");
              load({});
            }}
          >
            Temizle
          </button>
        )}
      </AdminFilterBar>
      <table className="adm-table">
        <thead>
          <tr>
            <th>Kimden</th>
            <th>Kime</th>
            <th>İlan</th>
            <th>Mesaj</th>
            <th>Okundu</th>
            <th>Tarih</th>
          </tr>
        </thead>
        <tbody>
          {(data.messages || []).length === 0 && (
            <tr>
              <td colSpan={6} style={{ color: "var(--adm-muted)" }}>
                Filtreye uyan mesaj yok.
              </td>
            </tr>
          )}
          {(data.messages || []).map((m: any) => (
            <tr key={m.id}>
              <td>{m.sender?.name || m.sender?.phone}</td>
              <td>{m.receiver?.name || m.receiver?.phone}</td>
              <td>{m.listing?.title || "—"}</td>
              <td style={{ maxWidth: 280, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.body}</td>
              <td>
                <button
                  className="btn-outline"
                  style={{ padding: "4px 8px" }}
                  onClick={async () => {
                    await fetch("/api/admin", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "mark-message-read", messageId: m.id, isRead: !m.isRead }),
                    });
                    load();
                  }}
                >
                  {m.isRead ? "Okundu" : "Okunmadı"}
                </button>
              </td>
              <td>{new Date(m.createdAt).toLocaleString("tr-TR")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminContentPanel({ vertical }: { vertical?: AdminVertical } = {}) {
  const { data, load } = useAdminData();
  const { confirm } = useDialog();
  const [form, setForm] = useState({
    id: "",
    slug: "",
    title: "",
    body: "",
    kind: "HELP",
    isPublished: true,
    sortOrder: 0,
    bannerImage: "",
    bannerSubtitle: "Vitrin & Premium ile ilanınızı öne çıkarın.",
    bannerHrefOutline: "/ilan-ver",
    bannerHrefPrimary: "/ilan-ver",
    bannerCtaOutline: "Vitrin İlan",
    bannerCtaPrimary: "Premium İlan",
    promoLine1: "Mesaj atma. Pazarlık yapma.",
    promoLine2: "Gerçek teklifini ver.",
    promoLine3: "Piyasanın en şeffaf teklif sistemi TeklifBu'da!",
  });
  if (!data) return <div className="adm-card">Yükleniyor...</div>;

  const verticalLabel = vertical ? ADMIN_VERTICAL_META[vertical].label : null;
  const contents = (data.contents || []).filter((c: { kind: string; slug?: string }) => {
    if (c.kind === "BANNER" || c.kind === "PROMO") return false;
    if (!vertical) return true;
    return contentMatchesVertical(String(c.slug || ""), vertical);
  });

  function buildBody() {
    if (form.kind === "BANNER") {
      return JSON.stringify({
        imageUrl: form.bannerImage,
        subtitle: form.bannerSubtitle,
        href: form.bannerHrefPrimary,
        hrefOutline: form.bannerHrefOutline,
        hrefPrimary: form.bannerHrefPrimary,
        ctaOutline: form.bannerCtaOutline,
        ctaPrimary: form.bannerCtaPrimary,
      });
    }
    if (form.kind === "PROMO") {
      return JSON.stringify({
        imageUrl: form.bannerImage,
        subtitle: form.bannerSubtitle,
        href: form.bannerHrefPrimary || "/ilan-ver",
        line1: form.promoLine1,
        line2: form.promoLine2,
        line3: form.promoLine3,
      });
    }
    return form.body;
  }

  function loadBannerFields(body: string) {
    const raw = String(body || "").trim();
    const defaults = {
      bannerImage: "",
      bannerSubtitle: "Vitrin & Premium ile ilanınızı öne çıkarın.",
      bannerHrefOutline: "/ilan-ver",
      bannerHrefPrimary: "/ilan-ver",
      bannerCtaOutline: "Vitrin İlan",
      bannerCtaPrimary: "Premium İlan",
      promoLine1: "Mesaj atma. Pazarlık yapma.",
      promoLine2: "Gerçek teklifini ver.",
      promoLine3: "Piyasanın en şeffaf teklif sistemi TeklifBu'da!",
    };
    if (raw.startsWith("{")) {
      try {
        const j = JSON.parse(raw) as Record<string, string>;
        return {
          ...defaults,
          bannerImage: j.imageUrl || j.image || "",
          bannerSubtitle: j.subtitle || defaults.bannerSubtitle,
          bannerHrefOutline: j.hrefOutline || "/ilan-ver",
          bannerHrefPrimary: j.hrefPrimary || j.href || "/ilan-ver",
          bannerCtaOutline: j.ctaOutline || "Vitrin İlan",
          bannerCtaPrimary: j.ctaPrimary || "Premium İlan",
          promoLine1: j.line1 || defaults.promoLine1,
          promoLine2: j.line2 || defaults.promoLine2,
          promoLine3: j.line3 || defaults.promoLine3,
        };
      } catch {
        /* fallthrough */
      }
    }
    if (raw.startsWith("/") || raw.startsWith("http")) {
      return { ...defaults, bannerImage: raw };
    }
    return defaults;
  }

  async function save() {
    await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save-content",
        id: form.id || undefined,
        slug: form.slug,
        title: form.title,
        body: form.body,
        kind: form.kind,
        isPublished: form.isPublished,
        sortOrder: form.sortOrder,
      }),
    });
    setForm({
      id: "",
      slug: "",
      title: "",
      body: "",
      kind: "HELP",
      isPublished: true,
      sortOrder: 0,
      bannerImage: "",
      bannerSubtitle: "Vitrin & Premium ile ilanınızı öne çıkarın.",
      bannerHrefOutline: "/ilan-ver",
      bannerHrefPrimary: "/ilan-ver",
      bannerCtaOutline: "Vitrin İlan",
      bannerCtaPrimary: "Premium İlan",
      promoLine1: "Mesaj atma. Pazarlık yapma.",
      promoLine2: "Gerçek teklifini ver.",
      promoLine3: "Piyasanın en şeffaf teklif sistemi TeklifBu'da!",
    });
    load();
  }

  async function removeContent(c: { id: string; title: string }) {
    const ok = await confirm({
      title: "İçeriği sil",
      message: `"${c.title}" silinsin mi? Bu işlem geri alınamaz.`,
      confirmLabel: "Sil",
      cancelLabel: "Vazgeç",
      tone: "danger",
    });
    if (!ok) return;
    await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete-content", id: c.id }),
    });
    load();
  }

  return (
    <div className="adm-panel-wrap">
      {data.tenant && (
        <div className="adm-card" style={{ fontSize: 13 }}>
          Tenant: <strong>{data.tenant.name}</strong> ({data.tenant.slug}) · Plan: {data.tenant.plan}
          {verticalLabel ? (
            <>
              {" "}
              · Dikey: <strong>{verticalLabel}</strong>
            </>
          ) : null}
        </div>
      )}
      <div className="adm-card" style={{ display: "grid", gap: 10 }}>
        <div style={{ fontSize: 13, color: "var(--adm-muted)", lineHeight: 1.45 }}>
          Banner / reklam görselleri artık <strong>Reklam Ayarları</strong> menüsünden yönetilir. Bu sayfa yardım, SSS ve
          metin sayfaları içindir.
          {vertical ? (
            <>
              {" "}
              Dikey içerik için slug öneki:{" "}
              <code>{ADMIN_VERTICAL_META[vertical].contentSlugPrefix}</code>
            </>
          ) : null}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8 }}>
          <input className="input" placeholder="Başlık" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input className="input" placeholder="slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          <select className="select" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            {[
              { value: "PAGE", label: "PAGE" },
              { value: "HELP", label: "HELP" },
              { value: "FAQ", label: "FAQ" },
            ].map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          <button className="btn-orange" style={{ padding: "10px 14px" }} onClick={save}>
            {form.id ? "Güncelle" : "Yayınla"}
          </button>
        </div>
        <textarea className="input" style={{ minHeight: 100 }} placeholder="İçerik" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
      </div>
      <div className="adm-card" style={{ overflow: "auto" }}>
        <table className="adm-table">
          <thead>
            <tr>
              <th>Başlık</th>
              <th>Slug</th>
              <th>Tür</th>
              <th>Yayında</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {contents.map((c: any) => (
              <tr key={c.id}>
                <td>{c.title}</td>
                <td>{c.slug}</td>
                <td>{c.kind}</td>
                <td>{c.isPublished ? "Evet" : "Hayır"}</td>
                <td style={{ display: "flex", gap: 6 }}>
                  <button
                    className="btn-outline"
                    style={{ padding: "6px 10px" }}
                    onClick={() =>
                      setForm({
                        id: c.id,
                        slug: c.slug,
                        title: c.title,
                        body: c.body,
                        kind: ["PAGE", "HELP", "FAQ"].includes(c.kind) ? c.kind : "HELP",
                        isPublished: c.isPublished,
                        sortOrder: c.sortOrder,
                        bannerImage: "",
                        bannerSubtitle: "Vitrin & Premium ile ilanınızı öne çıkarın.",
                        bannerHrefOutline: "/ilan-ver",
                        bannerHrefPrimary: "/ilan-ver",
                        bannerCtaOutline: "Vitrin İlan",
                        bannerCtaPrimary: "Premium İlan",
                        promoLine1: "Mesaj atma. Pazarlık yapma.",
                        promoLine2: "Gerçek teklifini ver.",
                        promoLine3: "Piyasanın en şeffaf teklif sistemi TeklifBu'da!",
                      })
                    }
                  >
                    Düzenle
                  </button>
                  <button
                    className="btn-outline"
                    style={{ padding: "6px 10px" }}
                    onClick={() => removeContent(c)}
                  >
                    Sil
                  </button>
                </td>
              </tr>
            ))}
            {contents.length === 0 && (
              <tr>
                <td colSpan={5} style={{ color: "var(--adm-muted)" }}>
                  Henüz içerik yok. Yukarıdan ekleyin.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminLogsPanel() {
  const { data } = useAdminData();
  if (!data) return <div className="adm-card">Yükleniyor...</div>;
  return (
    <div className="adm-card" style={{ overflow: "auto" }}>
      <table className="adm-table">
        <thead>
          <tr>
            <th>Zaman</th>
            <th>Aktör</th>
            <th>Aksiyon</th>
            <th>Entity</th>
            <th>ID</th>
            <th>Meta</th>
          </tr>
        </thead>
        <tbody>
          {(data.auditLogs || []).map((l: any) => (
            <tr key={l.id}>
              <td style={{ whiteSpace: "nowrap" }}>{new Date(l.createdAt).toLocaleString("tr-TR")}</td>
              <td>{l.actor?.name || l.actor?.phone || "—"}</td>
              <td>{l.action}</td>
              <td>{l.entity}</td>
              <td style={{ fontSize: 11 }}>{l.entityId || "—"}</td>
              <td style={{ fontSize: 11, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>
                {l.meta ? JSON.stringify(l.meta) : "—"}
              </td>
            </tr>
          ))}
          {!(data.auditLogs || []).length && (
            <tr>
              <td colSpan={6} style={{ color: "var(--adm-muted)" }}>
                Henüz log yok. Admin işlemleri burada görünecek.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function AdminReportsPanel() {
  const { data } = useAdminData();
  if (!data) return <div className="adm-card">Yükleniyor...</div>;
  const r = data.reports || {};
  const totals = r.totals || {};
  return (
    <div className="adm-panel-wrap">
      <div className="adm-kpi-grid" style={{ gridTemplateColumns: "repeat(4,minmax(0,1fr))" }}>
        {[
          ["İlan", totals.listings ?? data.listings?.length ?? 0],
          ["Teklif", totals.bids ?? data.bids?.length ?? 0],
          ["Kullanıcı", totals.users ?? data.users?.length ?? 0],
          ["Ödeme", totals.payments ?? data.payments?.length ?? 0],
          ["Mağaza", r.shops ?? data.shops?.length ?? 0],
          ["Mesaj", r.messages?.total ?? data.messages?.length ?? 0],
          ["İçerik", data.contents?.length ?? 0],
          ["Tenant", data.tenant?.name || "—"],
        ].map(([label, value]) => (
          <div key={String(label)} className="adm-kpi">
            <div className="adm-kpi-label">{label}</div>
            <div className="adm-kpi-value" style={{ fontSize: 22 }}>
              {String(value)}
            </div>
          </div>
        ))}
      </div>
      <div className="adm-card">
        <h3 style={{ marginTop: 0 }}>Kategori dağılımı</h3>
        <table className="adm-table">
          <thead>
            <tr>
              <th>Kategori</th>
              <th>İlan</th>
            </tr>
          </thead>
          <tbody>
            {(data.categories || []).map((c: any) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c._count?.listings ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="adm-card">
        <Link href="/admin" className="btn-orange" style={{ padding: "10px 14px", display: "inline-block" }}>
          Detaylı grafiklere git (Genel Bakış)
        </Link>
      </div>
    </div>
  );
}

export function AdminShopsManagePanel() {
  const { data, load } = useAdminData();
  const { alert, confirm } = useDialog();
  const [assign, setAssign] = useState({ userId: "", packageId: "", months: 1, days: 1, years: 1 });
  const [changeRow, setChangeRow] = useState<{
    userId: string;
    shopId: string;
    shopName: string;
    ownerLabel: string;
    packageId: string;
  } | null>(null);
  const [changeForm, setChangeForm] = useState({ packageId: "", months: 1, days: 1, years: 1, note: "" });
  const [busy, setBusy] = useState(false);

  if (!data) return <div className="adm-card">Yükleniyor...</div>;

  const assignPkg = (data.shopPackages || []).find((p: any) => p.id === assign.packageId);
  const assignBt = String(assignPkg?.billingType || "").toUpperCase();
  const assignDaily = assignBt === "DAILY";
  const assignYearly = assignBt === "YEARLY" || assignBt === "ANNUAL" || assignBt === "YEAR";
  const changePkg = (data.shopPackages || []).find((p: any) => p.id === changeForm.packageId);
  const changeBt = String(changePkg?.billingType || "").toUpperCase();
  const changeDaily = changeBt === "DAILY";
  const changeYearly = changeBt === "YEARLY" || changeBt === "ANNUAL" || changeBt === "YEAR";

  async function saveChange() {
    if (!changeRow || !changeForm.packageId) {
      await alert({ title: "Eksik bilgi", message: "Paket seçmelisiniz.", tone: "warning" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign-shop-subscription",
          userId: changeRow.userId,
          packageId: changeForm.packageId,
          months: changeDaily || changeYearly ? undefined : changeForm.months,
          days: changeDaily ? changeForm.days : undefined,
          years: changeYearly ? changeForm.years : undefined,
          note: changeForm.note,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        await alert({ title: "Güncelleme başarısız", message: j.error || "İşlem tamamlanamadı", tone: "danger" });
        return;
      }
      setChangeRow(null);
      await alert({
        title: "Paket güncellendi",
        message: j.changed
          ? "Paket değiştirildi ve kullanıcıya bildirim gönderildi."
          : "Paket atandı ve kullanıcıya bildirim gönderildi.",
        tone: "success",
      });
      load();
    } finally {
      setBusy(false);
    }
  }

  async function cancelSub(s: any) {
    const userId = s.owner?.id || s.subscription?.userId;
    if (!userId) {
      await alert({ title: "Hata", message: "Mağaza sahibi bulunamadı.", tone: "danger" });
      return;
    }
    const pkgName = s.subscription?.package?.name || "paket";
    const ok = await confirm({
      title: "Paketi iptal et",
      message: `«${s.name}» mağazasının «${pkgName}» aboneliği iptal edilecek. Kullanıcıya kullanım sözleşmesi uyarısı ile bildirim gidecek. Emin misiniz?`,
      tone: "danger",
      confirmLabel: "İptal et",
      cancelLabel: "Vazgeç",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel-shop-subscription",
          userId,
          shopId: s.id,
          note: "Yönetici iptali",
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        await alert({ title: "İptal başarısız", message: j.error || "İşlem tamamlanamadı", tone: "danger" });
        return;
      }
      await alert({
        title: "Paket iptal edildi",
        message: "Abonelik kapatıldı ve kullanıcıya bildirim gönderildi.",
        tone: "success",
      });
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="adm-panel-wrap">
      <div className="adm-card" style={{ display: "grid", gap: 10, gridTemplateColumns: "2fr 2fr 1fr auto" }}>
        <select className="select" value={assign.userId} onChange={(e) => setAssign({ ...assign, userId: e.target.value })}>
          <option value="">Kullanıcı</option>
          {(data.users || [])
            .filter((u: any) => u.accountType !== "BIREYSEL")
            .map((u: any) => (
              <option key={u.id} value={u.id}>
                {u.name || u.phone} ({u.accountType})
              </option>
            ))}
        </select>
        <select
          className="select"
          value={assign.packageId}
          onChange={(e) => {
            const id = e.target.value;
            const pkg = (data.shopPackages || []).find((p: any) => p.id === id);
            setAssign({
              ...assign,
              packageId: id,
              days: Math.max(1, Number(pkg?.minDays) || 1),
            });
          }}
        >
          <option value="">Paket</option>
          {(data.shopPackages || []).map((p: any) => (
            <option key={p.id} value={p.id}>
              {p.name} ·{" "}
              {String(p.billingType).toUpperCase() === "DAILY"
                ? `${formatTl(p.monthlyPrice)}/gün`
                : String(p.billingType).toUpperCase() === "YEARLY"
                  ? `${formatTl(p.monthlyPrice)}/yıl`
                  : `${formatTl(p.monthlyPrice)}/ay`}{" "}
              · {p.listingLimit} ilan
            </option>
          ))}
        </select>
        {assignDaily ? (
          <input
            className="input"
            type="number"
            min={assignPkg?.minDays || 1}
            max={assignPkg?.maxDays || 90}
            value={assign.days}
            onChange={(e) => setAssign({ ...assign, days: Number(e.target.value) })}
            title="Gün"
          />
        ) : assignYearly ? (
          <input
            className="input"
            type="number"
            min={1}
            max={5}
            value={assign.years}
            onChange={(e) => setAssign({ ...assign, years: Number(e.target.value) })}
            title="Yıl"
          />
        ) : (
          <input
            className="input"
            type="number"
            min={1}
            value={assign.months}
            onChange={(e) => setAssign({ ...assign, months: Number(e.target.value) })}
            title="Ay"
          />
        )}
        <button
          className="btn-orange"
          style={{ padding: "10px 14px" }}
          disabled={busy}
          onClick={async () => {
            if (!assign.userId || !assign.packageId) {
              await alert({
                title: "Eksik bilgi",
                message: "Kullanıcı ve paket seçmelisiniz.",
                tone: "warning",
              });
              return;
            }
            setBusy(true);
            try {
              const res = await fetch("/api/admin", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "assign-shop-subscription",
                  userId: assign.userId,
                  packageId: assign.packageId,
                  months: assignDaily || assignYearly ? undefined : assign.months,
                  days: assignDaily ? assign.days : undefined,
                  years: assignYearly ? assign.years : undefined,
                }),
              });
              if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                await alert({ title: "Atama başarısız", message: j.error || "İşlem tamamlanamadı", tone: "danger" });
                return;
              }
              await alert({
                title: "Abonelik atandı",
                message: "Paket tanımlandı ve kullanıcıya bildirim gönderildi.",
                tone: "success",
              });
              load();
            } finally {
              setBusy(false);
            }
          }}
        >
          Abonelik Ata
        </button>
      </div>
      <div className="adm-card" style={{ overflow: "auto" }}>
        <table className="adm-table">
          <thead>
            <tr>
              <th>Mağaza</th>
              <th>Sahip</th>
              <th>Tip</th>
              <th>Paket</th>
              <th>Limit</th>
              <th>Bitiş</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {(data.shops || []).map((s: any) => {
              const subActive =
                s.subscription?.isActive &&
                s.subscription?.endsAt &&
                new Date(s.subscription.endsAt) > new Date();
              return (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.owner?.name || s.owner?.phone}</td>
                  <td>{s.accountType}</td>
                  <td>
                    {s.subscription?.package?.name || "—"}
                    {s.subscription && !subActive ? (
                      <span style={{ display: "block", fontSize: 11, color: "#b91c1c", fontWeight: 700 }}>
                        İptal / süresi dolmuş
                      </span>
                    ) : null}
                  </td>
                  <td>{s.subscription?.package?.listingLimit ?? "—"}</td>
                  <td>{s.subscription?.endsAt ? new Date(s.subscription.endsAt).toLocaleDateString("tr-TR") : "—"}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="btn-outline"
                        style={{ padding: "6px 10px", fontSize: 12 }}
                        disabled={busy || !s.owner?.id}
                        onClick={() => {
                          setChangeRow({
                            userId: s.owner.id,
                            shopId: s.id,
                            shopName: s.name,
                            ownerLabel: s.owner?.name || s.owner?.phone || "",
                            packageId: s.subscription?.packageId || "",
                          });
                          setChangeForm({
                            packageId: s.subscription?.packageId || "",
                            months: 1,
                            days: 1,
                            note: "",
                          });
                        }}
                      >
                        Paketi değiştir
                      </button>
                      {subActive ? (
                        <button
                          type="button"
                          className="btn-outline"
                          style={{ padding: "6px 10px", fontSize: 12, color: "#b91c1c", borderColor: "#fecaca" }}
                          disabled={busy}
                          onClick={() => cancelSub(s)}
                        >
                          İptal et
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!(data.shops || []).length && (
              <tr>
                <td colSpan={7} style={{ color: "var(--adm-muted)" }}>
                  Henüz mağaza yok. Kurumsal kullanıcıya paket atayınca oluşur.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {changeRow ? (
        <div className="modal-backdrop" onClick={busy ? undefined : () => setChangeRow(null)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(440px, 100%)", padding: 18, display: "grid", gap: 12, textAlign: "left" }}
          >
            <h3 style={{ margin: 0 }}>Paketi değiştir</h3>
            <p style={{ margin: 0, fontSize: 13, color: "var(--adm-muted)", lineHeight: 1.45 }}>
              {changeRow.shopName} · {changeRow.ownerLabel}
              <br />
              Değişiklik kullanıcıya bildirim olarak iletilir.
            </p>
            <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
              Yeni paket
              <select
                className="select"
                value={changeForm.packageId}
                onChange={(e) => {
                  const id = e.target.value;
                  const pkg = (data.shopPackages || []).find((p: any) => p.id === id);
                  setChangeForm({
                    ...changeForm,
                    packageId: id,
                    days: Math.max(1, Number(pkg?.minDays) || 1),
                  });
                }}
              >
                <option value="">Paket seçin</option>
                {(data.shopPackages || []).map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ·{" "}
                    {String(p.billingType).toUpperCase() === "DAILY"
                      ? "günlük"
                      : String(p.billingType).toUpperCase() === "YEARLY"
                        ? "yıllık"
                        : "aylık"}{" "}
                    · {p.listingLimit} ilan
                  </option>
                ))}
              </select>
            </label>
            {changeDaily ? (
              <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
                Gün sayısı ({changePkg?.minDays || 1}–{changePkg?.maxDays || 30})
                <input
                  className="input"
                  type="number"
                  min={changePkg?.minDays || 1}
                  max={changePkg?.maxDays || 90}
                  value={changeForm.days}
                  onChange={(e) => setChangeForm({ ...changeForm, days: Number(e.target.value) || 1 })}
                />
              </label>
            ) : changeYearly ? (
              <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
                Süre (yıl)
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={5}
                  value={changeForm.years}
                  onChange={(e) => setChangeForm({ ...changeForm, years: Number(e.target.value) || 1 })}
                />
              </label>
            ) : (
              <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
                Süre (ay)
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={24}
                  value={changeForm.months}
                  onChange={(e) => setChangeForm({ ...changeForm, months: Number(e.target.value) || 1 })}
                />
              </label>
            )}
            <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
              Not (bildirimde görünür, isteğe bağlı)
              <textarea
                className="input"
                rows={2}
                value={changeForm.note}
                onChange={(e) => setChangeForm({ ...changeForm, note: e.target.value })}
                placeholder="Örn. ek ilan hakkı tanındı"
              />
            </label>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn-outline" style={{ padding: 10 }} disabled={busy} onClick={() => setChangeRow(null)}>
                Vazgeç
              </button>
              <button type="button" className="btn-orange" style={{ padding: 10, fontWeight: 800 }} disabled={busy} onClick={saveChange}>
                {busy ? "Kaydediliyor…" : "Kaydet ve bildir"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AdminShopsPanel />
    </div>
  );
}

function ExpiryRulesEditor({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const rules = normalizeListingExpiryRules(value);

  function patch(next: ListingExpiryRules) {
    onChange(next);
  }

  const box: React.CSSProperties = {
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 14,
    background: "#fff",
    display: "grid",
    gap: 12,
  };
  const row: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "minmax(160px, 1fr) minmax(180px, 1.2fr)",
    gap: 10,
    alignItems: "center",
  };
  const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: "#334155" };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={box}>
        <strong style={{ fontSize: 14 }}>Teklifli ilanlar</strong>
        <div style={row}>
          <span style={labelStyle}>İlan süresi dolunca</span>
          <select
            className="select"
            value={rules.bidding.afterEnd}
            onChange={(e) =>
              patch({
                ...rules,
                bidding: {
                  ...rules.bidding,
                  afterEnd: e.target.value as ListingExpiryRules["bidding"]["afterEnd"],
                },
              })
            }
          >
            <option value="selection">Seçim penceresi açılsın</option>
            <option value="grace">Bir süre daha beklesin, sonra kalsın</option>
            <option value="hide_immediate">Hemen kalksın (EXPIRED)</option>
          </select>
        </div>
        {rules.bidding.afterEnd === "selection" && (
          <div style={row}>
            <span style={labelStyle}>Seçim penceresi</span>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                className="input"
                type="number"
                min={0}
                value={rules.bidding.selectionMinutes}
                onChange={(e) =>
                  patch({
                    ...rules,
                    bidding: { ...rules.bidding, selectionMinutes: Number(e.target.value) || 0 },
                  })
                }
              />
              <span style={{ fontSize: 12, color: "#64748b", fontWeight: 650 }}>dakika</span>
            </label>
          </div>
        )}
        {rules.bidding.afterEnd === "grace" && (
          <div style={row}>
            <span style={labelStyle}>Ekstra bekleme</span>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                className="input"
                type="number"
                min={0}
                value={rules.bidding.graceMinutes}
                onChange={(e) =>
                  patch({
                    ...rules,
                    bidding: { ...rules.bidding, graceMinutes: Number(e.target.value) || 0 },
                  })
                }
              />
              <span style={{ fontSize: 12, color: "#64748b", fontWeight: 650 }}>dakika</span>
            </label>
          </div>
        )}
        <div style={row}>
          <span style={labelStyle}>Onay yoksa «süresi doldu» vitrinde</span>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              className="input"
              type="number"
              min={0}
              value={rules.bidding.expiredVisibleDays}
              onChange={(e) =>
                patch({
                  ...rules,
                  bidding: { ...rules.bidding, expiredVisibleDays: Number(e.target.value) || 0 },
                })
              }
            />
            <span style={{ fontSize: 12, color: "#64748b", fontWeight: 650 }}>gün (0 = hemen kalkar)</span>
          </label>
        </div>
        <div style={row}>
          <span style={labelStyle}>Teklif onaylanınca</span>
          <select
            className="select"
            value={rules.bidding.onApprove}
            onChange={(e) =>
              patch({
                ...rules,
                bidding: {
                  ...rules.bidding,
                  onApprove: e.target.value === "hide_immediate" ? "hide_immediate" : "show_completed",
                },
              })
            }
          >
            <option value="show_completed">«Sonuçlandı» olarak göster</option>
            <option value="hide_immediate">Hemen kalksın</option>
          </select>
        </div>
        {rules.bidding.onApprove === "show_completed" && (
          <div style={row}>
            <span style={labelStyle}>Sonuçlandı görünürlüğü</span>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                className="input"
                type="number"
                min={0}
                value={rules.bidding.approvedVisibleDays}
                onChange={(e) =>
                  patch({
                    ...rules,
                    bidding: { ...rules.bidding, approvedVisibleDays: Number(e.target.value) || 0 },
                  })
                }
              />
              <span style={{ fontSize: 12, color: "#64748b", fontWeight: 650 }}>gün</span>
            </label>
          </div>
        )}
      </div>

      <div style={box}>
        <strong style={{ fontSize: 14 }}>Teklifsiz ilanlar</strong>
        <div style={row}>
          <span style={labelStyle}>İlan süresi dolunca</span>
          <select
            className="select"
            value={rules.classified.afterEnd}
            onChange={(e) =>
              patch({
                ...rules,
                classified: {
                  ...rules.classified,
                  afterEnd: e.target.value === "hide_immediate" ? "hide_immediate" : "grace",
                },
              })
            }
          >
            <option value="grace">X gün vitrinde kalsın, sonra kalksın</option>
            <option value="hide_immediate">Hemen kalksın</option>
          </select>
        </div>
        {rules.classified.afterEnd === "grace" && (
          <div style={row}>
            <span style={labelStyle}>Gösterimde kalma</span>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                className="input"
                type="number"
                min={0}
                value={rules.classified.graceDays}
                onChange={(e) =>
                  patch({
                    ...rules,
                    classified: { ...rules.classified, graceDays: Number(e.target.value) || 0 },
                  })
                }
              />
              <span style={{ fontSize: 12, color: "#64748b", fontWeight: 650 }}>gün</span>
            </label>
          </div>
        )}
      </div>

      <div style={box}>
        <strong style={{ fontSize: 14 }}>Satın al (Al butonu / Güvenli Öde)</strong>
        <p style={{ margin: 0, fontSize: 12.5, color: "#64748b", lineHeight: 1.45 }}>
          Teklifsiz ilanda tek yol veya teklifli ilanda hibrit Al. Süre bitince teklifli tarafta Al kapanabilir.
        </p>
        <div style={row}>
          <span style={labelStyle}>Buton metni</span>
          <input
            className="input"
            value={rules.buyButtonLabel}
            onChange={(e) => patch({ ...rules, buyButtonLabel: e.target.value.slice(0, 32) })}
            placeholder="Satın al"
          />
        </div>
        <div style={row}>
          <span style={labelStyle}>İlan süresi dolunca</span>
          <select
            className="select"
            value={rules.buy.afterEnd}
            onChange={(e) =>
              patch({
                ...rules,
                buy: {
                  ...rules.buy,
                  afterEnd: e.target.value === "grace" ? "grace" : "hide_immediate",
                },
              })
            }
          >
            <option value="hide_immediate">Hemen kalksın</option>
            <option value="grace">X gün vitrinde kalsın</option>
          </select>
        </div>
        {rules.buy.afterEnd === "grace" && (
          <div style={row}>
            <span style={labelStyle}>Gösterimde kalma</span>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                className="input"
                type="number"
                min={0}
                value={rules.buy.graceDays}
                onChange={(e) =>
                  patch({
                    ...rules,
                    buy: { ...rules.buy, graceDays: Number(e.target.value) || 0 },
                  })
                }
              />
              <span style={{ fontSize: 12, color: "#64748b", fontWeight: 650 }}>gün</span>
            </label>
          </div>
        )}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            fontWeight: 700,
            color: "#334155",
          }}
        >
          <input
            type="checkbox"
            checked={rules.buy.closesWhenBiddingEnds}
            onChange={(e) =>
              patch({
                ...rules,
                buy: { ...rules.buy, closesWhenBiddingEnds: e.target.checked },
              })
            }
          />
          Hibritte teklif süresi bitince Al butonu kapansın
        </label>
      </div>
    </div>
  );
}

function SettingInput({
  settingKey,
  meta,
  value,
  onChange,
}: {
  settingKey: string;
  meta: any;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const control = meta.control || (typeof value === "boolean" ? "toggle" : typeof value === "number" ? "number" : typeof value === "string" ? "text" : "json");
  const unit = meta.unit ? <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{meta.unit}</span> : null;

  if (control === "toggle") {
    return (
      <label
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 12px",
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          background: value ? "#ecfdf5" : "#f8fafc",
          fontWeight: 700,
          cursor: "pointer",
          width: "fit-content",
        }}
      >
        <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
        {value ? "Açık" : "Kapalı"}
      </label>
    );
  }

  if (control === "number") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: 280 }}>
        <input
          className="input"
          type="number"
          min={meta.min}
          max={meta.max}
          value={Number(value ?? 0)}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {unit}
      </div>
    );
  }

  if (control === "text") {
    return <input className="input" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} style={{ maxWidth: 420 }} />;
  }

  if (control === "textarea") {
    return (
      <textarea
        className="input"
        style={{ minHeight: 90 }}
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (control === "color") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input type="color" value={String(value || "#000000")} onChange={(e) => onChange(e.target.value)} />
        <input className="input" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} style={{ maxWidth: 160 }} />
      </div>
    );
  }

  if (control === "select") {
    return (
      <select className="select" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} style={{ maxWidth: 360 }}>
        {(meta.options || []).map((o: { value: string; label: string }) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  if (control === "numberList") {
    const list = Array.isArray(value) ? (value as number[]) : [];
    return (
      <div style={{ display: "grid", gap: 8, maxWidth: 480 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {list.map((n, i) => (
            <div key={`${n}-${i}`} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <input
                className="input"
                type="number"
                style={{ width: 88 }}
                value={n}
                onChange={(e) => {
                  const next = [...list];
                  next[i] = Number(e.target.value);
                  onChange(next);
                }}
              />
              <button
                type="button"
                className="btn-outline"
                style={{ padding: "6px 8px" }}
                onClick={() => onChange(list.filter((_, idx) => idx !== i))}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="btn-outline"
          style={{ padding: "8px 12px", width: "fit-content" }}
          onClick={() => onChange([...list, list.length ? list[list.length - 1] : 1])}
        >
          + Değer ekle
        </button>
        {unit}
      </div>
    );
  }

  if (control === "bidTokenCosts") {
    const map = (value && typeof value === "object" ? value : {}) as Record<string, number>;
    const rows = Object.keys(map).length
      ? Object.entries(map).sort((a, b) => Number(a[0]) - Number(b[0]))
      : [
          ["1", 1],
          ["2", 1],
        ];
    return (
      <div style={{ display: "grid", gap: 8, maxWidth: 420 }}>
        {rows.map(([k, v], i) => (
          <div key={k} style={{ display: "grid", gridTemplateColumns: "1fr 120px auto", gap: 8, alignItems: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{k}. teklif</div>
            <input
              className="input"
              type="number"
              min={0}
              value={Number(v)}
              onChange={(e) => {
                const next = { ...map, [k]: Number(e.target.value) };
                onChange(next);
              }}
            />
            <span style={{ fontSize: 12, color: "#64748b" }}>jeton</span>
          </div>
        ))}
        <button
          type="button"
          className="btn-outline"
          style={{ padding: "8px 12px", width: "fit-content" }}
          onClick={() => {
            const nextN = String(rows.length + 1);
            onChange({ ...map, [nextN]: 1 });
          }}
        >
          + Sonraki teklif satırı
        </button>
      </div>
    );
  }

  if (control === "categoryCosts") {
    const map = (value && typeof value === "object" ? value : {}) as Record<string, number>;
    const cats = [
      { key: "konut", label: "Konut / Emlak" },
      { key: "arac", label: "Vasıta" },
      { key: "isyeri", label: "İşyeri" },
      { key: "arsa", label: "Arsa" },
      { key: "kiralik", label: "Kiralık" },
      { key: "ikinci-el", label: "İkinci El" },
      { key: "sifir-urun", label: "Sıfır Ürün" },
    ];
    return (
      <div style={{ display: "grid", gap: 8, maxWidth: 480 }}>
        {cats.map((c) => (
          <div key={c.key} style={{ display: "grid", gridTemplateColumns: "140px 1fr auto", gap: 8, alignItems: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{c.label}</div>
            <input
              className="input"
              type="number"
              min={0}
              placeholder="Boş = genel"
              value={map[c.key] ?? ""}
              onChange={(e) => {
                const next = { ...map };
                if (e.target.value === "") delete next[c.key];
                else next[c.key] = Number(e.target.value);
                onChange(next);
              }}
            />
            {unit}
          </div>
        ))}
      </div>
    );
  }

  if (control === "categoryAccessRules") {
    const map = (value && typeof value === "object" ? value : {}) as Record<
      string,
      { identity?: string; contact?: string; messaging?: string }
    >;
    const cats = [
      { key: "konut", label: "Konut / Emlak" },
      { key: "arac", label: "Vasıta" },
      { key: "isyeri", label: "İşyeri" },
      { key: "arsa", label: "Arsa" },
      { key: "kiralik", label: "Kiralık" },
      { key: "ikinci-el", label: "İkinci El" },
      { key: "sifir-urun", label: "Sıfır Ürün" },
      { key: "premium-otel", label: "Premium — Otel" },
      { key: "premium-lojistik", label: "Premium — Lojistik" },
      { key: "premium-yolculuk", label: "Premium — Yolculuk" },
    ];
    const modeOpts = [
      { value: "approved", label: "Teklif onayından sonra" },
      { value: "logged_in", label: "Giriş yapan herkese (onaysız)" },
    ];
    function row(slug: string) {
      const cur = map[slug] || {};
      return {
        identity: cur.identity === "logged_in" ? "logged_in" : "approved",
        contact: cur.contact === "logged_in" ? "logged_in" : "approved",
        messaging: cur.messaging === "logged_in" ? "logged_in" : "approved",
      };
    }
    function setField(slug: string, field: "identity" | "contact" | "messaging", v: string) {
      onChange({
        ...map,
        [slug]: { ...row(slug), [field]: v },
      });
    }
    return (
      <div style={{ display: "grid", gap: 10, maxWidth: 720 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "120px 1fr 1fr 1fr",
            gap: 8,
            fontSize: 11,
            fontWeight: 800,
            color: "#64748b",
          }}
        >
          <div>Kategori</div>
          <div>İlan sahibi</div>
          <div>İletişim (tel)</div>
          <div>Mesaj</div>
        </div>
        {cats.map((c) => {
          const r = row(c.key);
          return (
            <div
              key={c.key}
              style={{
                display: "grid",
                gridTemplateColumns: "120px 1fr 1fr 1fr",
                gap: 8,
                alignItems: "center",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 13 }}>{c.label}</div>
              {(["identity", "contact", "messaging"] as const).map((field) => (
                <select
                  key={field}
                  className="select"
                  value={r[field]}
                  onChange={(e) => setField(c.key, field, e.target.value)}
                  style={{ fontSize: 12, padding: "8px 10px" }}
                >
                  {modeOpts.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ))}
            </div>
          );
        })}
      </div>
    );
  }

  if (control === "accountFees") {
    const map = (value && typeof value === "object" ? value : {}) as Record<string, number>;
    const rows = [
      { key: "BIREYSEL_TICARI", label: "Bireysel" },
      { key: "TICARI", label: "Kurumsal" },
      { key: "BIREYSEL", label: "Bireysel (eski)" },
      { key: "EMLAKCI", label: "Kurumsal (eski emlakçı)" },
      { key: "GALERICI", label: "Kurumsal (eski galerici)" },
    ];
    return (
      <div style={{ display: "grid", gap: 8, maxWidth: 420 }}>
        {rows.map((r) => (
          <div key={r.key} style={{ display: "grid", gridTemplateColumns: "160px 1fr auto", gap: 8, alignItems: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{r.label}</div>
            <input
              className="input"
              type="number"
              min={0}
              value={Number(map[r.key] ?? 0)}
              onChange={(e) => onChange({ ...map, [r.key]: Number(e.target.value) })}
            />
            {unit}
          </div>
        ))}
      </div>
    );
  }

  if (control === "stringList") {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    const options = meta.options || [];
    return (
      <div style={{ display: "grid", gap: 8 }}>
        {options.map((o: { value: string; label: string }) => (
          <label key={o.value} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={selected.includes(o.value)}
              onChange={(e) => {
                if (e.target.checked) onChange([...selected, o.value]);
                else onChange(selected.filter((x) => x !== o.value));
              }}
            />
            {o.label}
          </label>
        ))}
      </div>
    );
  }

  if (control === "businessTypes") {
    return <BusinessTypesEditor value={value} onChange={onChange} />;
  }

  if (control === "flagMap") {
    const map = (value && typeof value === "object" ? value : {}) as Record<string, boolean>;
    const options = meta.options || Object.keys(map).map((k) => ({ value: k, label: k }));
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
        {options.map((o: { value: string; label: string }) => (
          <label
            key={o.value}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              background: map[o.value] ? "#ecfdf5" : "#fff",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            <input
              type="checkbox"
              checked={Boolean(map[o.value])}
              onChange={(e) => onChange({ ...map, [o.value]: e.target.checked })}
            />
            {o.label}
          </label>
        ))}
      </div>
    );
  }

  if (control === "expiryRules") {
    return (
      <ExpiryRulesEditor
        value={value}
        onChange={onChange}
      />
    );
  }

  // fallback
  void settingKey;
  return (
    <textarea
      className="input"
      style={{ minHeight: 80, fontFamily: "ui-monospace, monospace", fontSize: 12 }}
      value={JSON.stringify(value ?? {}, null, 2)}
      onChange={(e) => {
        try {
          onChange(JSON.parse(e.target.value));
        } catch {
          /* ignore while typing */
        }
      }}
    />
  );
}

function TokenForm({ initial, onClose, onSaved }: { initial?: any; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [tokenAmount, setTokenAmount] = useState(initial?.tokenAmount || 10);
  const [priceTl, setPriceTl] = useState(initial?.priceTl || 99);
  const [pricesIncludeVat, setPricesIncludeVat] = useState(initial?.pricesIncludeVat !== false);
  const [vatPercent, setVatPercent] = useState(
    Number.isFinite(Number(initial?.vatPercent)) ? Number(initial.vatPercent) : 20
  );
  const [discountPercent, setDiscountPercent] = useState(initial?.discountPercent || 0);
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder || 0);
  const vatPreview = (() => {
    const pct = Math.max(0, Math.min(40, Number(vatPercent) || 0));
    const input = Math.max(0, Number(priceTl) || 0);
    if (pct <= 0) return { net: input, vat: 0, gross: input };
    if (pricesIncludeVat) {
      const net = Math.round((input / (1 + pct / 100)) * 100) / 100;
      return { net, vat: Math.round((input - net) * 100) / 100, gross: input };
    }
    const vat = Math.round(((input * pct) / 100) * 100) / 100;
    return { net: input, vat, gross: Math.round((input + vat) * 100) / 100 };
  })();
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <h3 style={{ margin: 0 }}>Jeton Paketi</h3>
      <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
        Paket adı
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Örn. Başlangıç, Popüler, Pro"
        />
        <span style={{ fontWeight: 500, color: "#64748b" }}>
          Kullanıcının jeton sayfasında kart başlığı olarak görür.
        </span>
      </label>
      <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
        Açıklama
        <textarea
          className="input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Örn. Teklif vermek ve premium özellikler için ideal paket"
          rows={3}
          style={{ resize: "vertical", minHeight: 72 }}
        />
        <span style={{ fontWeight: 500, color: "#64748b" }}>
          Paket kartında adın altında kısa açıklama olarak görünür. Boş bırakılabilir.
        </span>
      </label>
      <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
        Jeton adedi
        <input
          className="input"
          type="number"
          min={1}
          value={tokenAmount}
          onChange={(e) => setTokenAmount(Number(e.target.value))}
          placeholder="Örn. 50"
        />
        <span style={{ fontWeight: 500, color: "#64748b" }}>
          Satın alınca kullanıcı bakiyesine eklenecek jeton sayısı.
        </span>
      </label>
      <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
        Fiyat (TL)
        <input
          className="input"
          type="number"
          min={0}
          value={priceTl}
          onChange={(e) => setPriceTl(Number(e.target.value))}
          placeholder="Örn. 99"
        />
        <span style={{ fontWeight: 500, color: "#64748b" }}>
          Paketin satış fiyatı (Türk Lirası).
        </span>
      </label>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={pricesIncludeVat}
          onChange={(e) => setPricesIncludeVat(e.target.checked)}
        />
        Fiyat KDV dahil mi?
      </label>
      <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
        KDV oranı (%)
        <input
          className="input"
          type="number"
          min={0}
          max={40}
          step="0.01"
          value={vatPercent}
          onChange={(e) => setVatPercent(Number(e.target.value))}
        />
      </label>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 8,
          padding: 10,
          borderRadius: 12,
          background: "#f8fafc",
          fontSize: 12,
        }}
      >
        <div>
          <div style={{ color: "#94a3b8", fontWeight: 700 }}>KDV hariç</div>
          <div style={{ fontWeight: 850 }}>{vatPreview.net.toLocaleString("tr-TR")} ₺</div>
        </div>
        <div>
          <div style={{ color: "#94a3b8", fontWeight: 700 }}>KDV</div>
          <div style={{ fontWeight: 850 }}>{vatPreview.vat.toLocaleString("tr-TR")} ₺</div>
        </div>
        <div>
          <div style={{ color: "#94a3b8", fontWeight: 700 }}>KDV dahil</div>
          <div style={{ fontWeight: 850 }}>{vatPreview.gross.toLocaleString("tr-TR")} ₺</div>
        </div>
      </div>
      <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
        İndirim / avantaj (%)
        <input
          className="input"
          type="number"
          min={0}
          max={90}
          value={discountPercent}
          onChange={(e) => setDiscountPercent(Number(e.target.value))}
          placeholder="0 = rozet yok"
        />
        <span style={{ fontWeight: 500, color: "#64748b" }}>
          0 girilirse rozet gizlenir. Örn. 20 → kartta “%20 avantaj” gösterilir.
        </span>
      </label>
      <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
        Sıra
        <input
          className="input"
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(Number(e.target.value))}
          placeholder="0"
        />
        <span style={{ fontWeight: 500, color: "#64748b" }}>
          Küçük sayı önce listelenir (0, 1, 2…).
        </span>
      </label>
      <div style={{ display: "flex", gap: 8, justifyContent: "end" }}>
        <button className="btn-outline" style={{ padding: 10 }} onClick={onClose}>
          İptal
        </button>
        <button
          className="btn-orange"
          style={{ padding: 10 }}
          onClick={async () => {
            await fetch("/api/admin", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "save-token-package",
                id: initial?.id,
                name,
                description,
                tokenAmount,
                priceTl,
                pricesIncludeVat,
                vatPercent,
                discountPercent,
                sortOrder,
                isActive: true,
              }),
            });
            onSaved();
          }}
        >
          Kaydet
        </button>
      </div>
    </div>
  );
}

function ShopForm({ initial, onClose, onSaved }: { initial?: any; onClose: () => void; onSaved: () => void }) {
  const initialBilling = (() => {
    const v = String(initial?.billingType || "MONTHLY").toUpperCase();
    if (v === "DAILY") return "DAILY";
    if (v === "YEARLY" || v === "ANNUAL" || v === "YEAR") return "YEARLY";
    return "MONTHLY";
  })();
  const [name, setName] = useState(initial?.name || "");
  const [accountType, setAccountType] = useState(initial?.accountType || "TICARI");
  const [billingType, setBillingType] = useState(initialBilling);
  const [monthlyPrice, setMonthlyPrice] = useState(
    initial?.monthlyPrice ?? (initialBilling === "DAILY" ? 1 : initialBilling === "YEARLY" ? 12000 : 2500)
  );
  const [pricesIncludeVat, setPricesIncludeVat] = useState(initial?.pricesIncludeVat !== false);
  const [vatPercent, setVatPercent] = useState(
    Number.isFinite(Number(initial?.vatPercent)) ? Number(initial.vatPercent) : 20
  );
  const [tokenPrice, setTokenPrice] = useState(
    initial?.tokenPrice != null && Number(initial.tokenPrice) > 0 ? Number(initial.tokenPrice) : ""
  );
  const [listingLimit, setListingLimit] = useState(initial?.listingLimit || 1);
  const [minDays, setMinDays] = useState(Number(initial?.minDays) || 1);
  const [maxDays, setMaxDays] = useState(Number(initial?.maxDays) || 30);
  const [premiumDiscountPercent, setPremiumDiscountPercent] = useState(
    Number(initial?.premiumDiscountPercent) || 0
  );
  const [description, setDescription] = useState(initial?.description || "");
  const daily = billingType === "DAILY";
  const yearly = billingType === "YEARLY";
  const priceLabel = daily ? "Günlük ücret (TL)" : yearly ? "Yıllık ücret (TL)" : "Aylık ücret (TL)";
  const tokenLabel = daily
    ? "Günlük jeton fiyatı (opsiyonel)"
    : yearly
      ? "Yıllık jeton fiyatı (opsiyonel)"
      : "Aylık jeton fiyatı (opsiyonel)";
  const vatPreview = (() => {
    const pct = Math.max(0, Math.min(40, Number(vatPercent) || 0));
    const input = Math.max(0, Number(monthlyPrice) || 0);
    if (pct <= 0) return { net: input, vat: 0, gross: input };
    if (pricesIncludeVat) {
      const net = Math.round((input / (1 + pct / 100)) * 100) / 100;
      return { net, vat: Math.round((input - net) * 100) / 100, gross: input };
    }
    const vat = Math.round(((input * pct) / 100) * 100) / 100;
    return { net: input, vat, gross: Math.round((input + vat) * 100) / 100 };
  })();
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <h3 style={{ margin: 0 }}>İlan Paketi</h3>
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ad (örn. Yıllık Kurumsal)" />
      <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
        Üyelik tipi
        <select className="select" value={accountType} onChange={(e) => setAccountType(e.target.value)}>
          <option value="TICARI">Kurumsal</option>
          <option value="BIREYSEL_TICARI">Bireysel</option>
        </select>
      </label>
      <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
        Faturalama
        <select className="select" value={billingType} onChange={(e) => setBillingType(e.target.value)}>
          <option value="MONTHLY">Aylık paket</option>
          <option value="DAILY">Günlük paket (kullanıcı gün seçer)</option>
          <option value="YEARLY">Yıllık paket (kullanıcı yıl seçer)</option>
        </select>
      </label>
      <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
        {priceLabel}
        <input
          className="input"
          type="number"
          min={0}
          value={monthlyPrice}
          onChange={(e) => setMonthlyPrice(Number(e.target.value))}
        />
        {daily ? (
          <span style={{ fontWeight: 500, color: "#64748b" }}>
            Örn. 1 TL/gün → 25 gün seçilirse 25 TL. İlan adedi kadar eşzamanlı ilan hakkı verir.
          </span>
        ) : null}
        {yearly ? (
          <span style={{ fontWeight: 500, color: "#64748b" }}>
            Örn. 12.000 TL/yıl → 2 yıl seçilirse 24.000 TL. Kullanıcı 1–5 yıl seçebilir.
          </span>
        ) : null}
      </label>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={pricesIncludeVat}
          onChange={(e) => setPricesIncludeVat(e.target.checked)}
        />
        Ücret KDV dahil mi?
      </label>
      <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
        KDV oranı (%)
        <input
          className="input"
          type="number"
          min={0}
          max={40}
          step="0.01"
          value={vatPercent}
          onChange={(e) => setVatPercent(Number(e.target.value))}
        />
      </label>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 8,
          padding: 10,
          borderRadius: 12,
          background: "#f8fafc",
          fontSize: 12,
        }}
      >
        <div>
          <div style={{ color: "#94a3b8", fontWeight: 700 }}>KDV hariç</div>
          <div style={{ fontWeight: 850 }}>{vatPreview.net.toLocaleString("tr-TR")} ₺</div>
        </div>
        <div>
          <div style={{ color: "#94a3b8", fontWeight: 700 }}>KDV</div>
          <div style={{ fontWeight: 850 }}>{vatPreview.vat.toLocaleString("tr-TR")} ₺</div>
        </div>
        <div>
          <div style={{ color: "#94a3b8", fontWeight: 700 }}>KDV dahil</div>
          <div style={{ fontWeight: 850 }}>{vatPreview.gross.toLocaleString("tr-TR")} ₺</div>
        </div>
      </div>
      <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
        {tokenLabel}
        <input
          className="input"
          type="number"
          min={0}
          placeholder="Boş = TL’den otomatik çevrilir (POS kapalıysa)"
          value={tokenPrice}
          onChange={(e) => setTokenPrice(e.target.value === "" ? "" : Number(e.target.value))}
        />
        <span style={{ fontWeight: 500, color: "#64748b" }}>
          Demo POS kapalıyken jetonla satışta kullanılır. Süre (ay/gün/yıl) ile çarpılır.
        </span>
      </label>
      <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
        İlan adedi (eşzamanlı hak)
        <input
          className="input"
          type="number"
          min={1}
          value={listingLimit}
          onChange={(e) => setListingLimit(Number(e.target.value))}
        />
      </label>
      {daily ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
            Min gün
            <input className="input" type="number" min={1} value={minDays} onChange={(e) => setMinDays(Number(e.target.value))} />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
            Max gün
            <input className="input" type="number" min={1} value={maxDays} onChange={(e) => setMaxDays(Number(e.target.value))} />
          </label>
        </div>
      ) : null}
      <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
        Premium özellik indirimi (%)
        <input
          className="input"
          type="number"
          min={0}
          max={100}
          value={premiumDiscountPercent}
          onChange={(e) => setPremiumDiscountPercent(Number(e.target.value))}
        />
        <span style={{ fontWeight: 500, color: "#64748b" }}>
          Aktif abonelerde kalın başlık, renkli ilan, ana sayfa vb. premium özelliklere uygulanır.
        </span>
      </label>
      <textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Açıklama" />
      <div style={{ display: "flex", gap: 8, justifyContent: "end" }}>
        <button className="btn-outline" style={{ padding: 10 }} onClick={onClose}>
          İptal
        </button>
        <button
          className="btn-orange"
          style={{ padding: 10 }}
          onClick={async () => {
            await fetch("/api/admin", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "save-shop-package",
                id: initial?.id,
                name,
                accountType,
                billingType,
                monthlyPrice,
                pricesIncludeVat,
                vatPercent,
                tokenPrice: tokenPrice === "" ? null : Number(tokenPrice),
                listingLimit,
                minDays,
                maxDays,
                premiumDiscountPercent,
                description,
                isActive: true,
              }),
            });
            onSaved();
          }}
        >
          Kaydet
        </button>
      </div>
    </div>
  );
}
