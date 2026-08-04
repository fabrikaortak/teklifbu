"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, ExternalLink, Settings, LayoutDashboard } from "lucide-react";

export default function AdminAccountPage() {
  const router = useRouter();
  const [admin, setAdmin] = useState<{ name?: string | null; phone?: string | null; role?: string } | null>(null);
  const [tenant, setTenant] = useState<{ name?: string; slug?: string; plan?: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin?view=dashboard")
      .then((r) => r.json())
      .then((d) => {
        setAdmin(d.adminUser || null);
        setTenant(d.tenant || null);
      });
  }, []);

  async function logout() {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    window.dispatchEvent(new Event("teklifbu:auth"));
    router.push("/");
    router.refresh();
  }

  return (
    <div>
      <div className="adm-page-head">
        <div>
          <h1>Hesabım</h1>
          <p>Admin hesabı ve oturum yönetimi.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 420px) minmax(0, 1fr)", gap: 16 }}>
        <div className="adm-card" style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              className="adm-avatar"
              style={{ width: 56, height: 56, fontSize: 22 }}
            >
              {(admin?.name || "A").slice(0, 1).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{admin?.name || "Sistem Admin"}</div>
              <div style={{ fontSize: 13, color: "var(--adm-muted)" }}>{admin?.phone || "—"}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--adm-orange)", marginTop: 4 }}>Admin</div>
            </div>
          </div>

          {tenant && (
            <div style={{ background: "#f8fafc", borderRadius: 12, padding: 12, fontSize: 13 }}>
              <div style={{ color: "var(--adm-muted)", marginBottom: 4 }}>Tenant</div>
              <strong>{tenant.name}</strong> ({tenant.slug}) · Plan: {tenant.plan}
            </div>
          )}

          <button
            type="button"
            className="btn-orange"
            style={{ padding: 14, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            onClick={logout}
          >
            <LogOut size={18} /> Çıkış Yap
          </button>
        </div>

        <div className="adm-card" style={{ display: "grid", gap: 10, alignContent: "start" }}>
          <h3 style={{ margin: 0 }}>Hızlı bağlantılar</h3>
          <Link href="/admin" className="btn-outline" style={{ padding: 12, display: "inline-flex", alignItems: "center", gap: 8 }}>
            <LayoutDashboard size={16} /> Genel Bakış
          </Link>
          <Link href="/admin/ayarlar" className="btn-outline" style={{ padding: 12, display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Settings size={16} /> Sistem Ayarları
          </Link>
          <Link href="/" className="btn-outline" style={{ padding: 12, display: "inline-flex", alignItems: "center", gap: 8 }}>
            <ExternalLink size={16} /> Siteye Dön
          </Link>
        </div>
      </div>
    </div>
  );
}
