"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { MagazaPanelShell, type MagazaModules } from "@/components/magaza/MagazaPanelShell";
import { parseCommercialProfile } from "@/data/commercialProfile";

export function MagazaPanelGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [shopName, setShopName] = useState("");
  const [modules, setModules] = useState<MagazaModules>({
    listings: true,
    questions: true,
    orders: true,
  });
  const [blocked, setBlocked] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const authRes = await fetch("/api/auth");
        const auth = await authRes.json().catch(() => ({}));
        if (cancelled) return;
        if (!auth?.user) {
          router.replace("/giris?next=/magaza/panel");
          return;
        }

        const p = parseCommercialProfile(auth.user.profile);
        const fallbackName = p.commercialTitle || auth.user.name || "Mağazanız";

        const res = await fetch("/api/magaza/panel?view=overview");
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (res.status === 401) {
          router.replace("/giris?next=/magaza/panel");
          return;
        }

        if (!res.ok) {
          setShopName(fallbackName);
          setBlocked(data.error || "Satıcı paneline erişemezsiniz.");
          setReady(true);
          return;
        }

        setShopName(data.shop?.name || fallbackName);
        if (data.access?.modules) setModules(data.access.modules);
        setReady(true);
      } catch (e) {
        if (cancelled) return;
        console.error("MagazaPanelGate", e);
        setBlocked("Satıcı paneli yüklenemedi. Sayfayı yenileyin.");
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready) {
    return (
      <div className="sp-shell">
        <div className="sp-card" style={{ textAlign: "center", padding: 40 }}>
          Satıcı paneli yükleniyor…
        </div>
      </div>
    );
  }

  if (blocked) {
    return (
      <div className="sp-shell">
        <div className="sp-card" style={{ textAlign: "center", display: "grid", gap: 12, justifyItems: "center" }}>
          <h1 style={{ margin: 0, fontSize: 20 }}>Satıcı Paneli</h1>
          <p className="sp-muted" style={{ maxWidth: 420 }}>
            {blocked}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            <a href="/hesabim" className="sp-btn-outline">
              Hesabıma dön
            </a>
            <button type="button" className="sp-btn" onClick={() => window.location.reload()}>
              Yenile
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <MagazaPanelShell shopName={shopName} modules={modules}>
      {children}
    </MagazaPanelShell>
  );
}
