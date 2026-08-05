"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  CreditCard,
  BarChart3,
  Settings,
  ScrollText,
  Search,
  Sun,
  Bell,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  LogOut,
  UserRound,
  Wallet,
  Megaphone,
  Sparkles,
  UserCog,
  PanelBottom,
  Palette,
  Hotel,
  Building2,
  ShoppingBag,
  Car,
  Store,
} from "lucide-react";

type NavChild = {
  href: string;
  label: string;
  badge?: number;
};

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: number;
  children?: NavChild[];
  /** openMenus key */
  menuKey?: string;
};

function verticalChildren(
  base: string,
  counts: {
    pending: number;
    edit: number;
    extension: number;
  },
  extras?: NavChild[]
): NavChild[] {
  return [
    { href: base, label: "Özet" },
    { href: `${base}/ilanlar`, label: "İlanlar" },
    {
      href: `${base}/ilan-onay`,
      label: "İlan onayları",
      badge: counts.pending > 0 ? counts.pending : undefined,
    },
    {
      href: `${base}/duzenleme-onay`,
      label: "Düzenleme talepleri",
      badge: counts.edit > 0 ? counts.edit : undefined,
    },
    {
      href: `${base}/ek-sure`,
      label: "Ek süre",
      badge: counts.extension > 0 ? counts.extension : undefined,
    },
    // Teklif = listing bid; her dikey kendi ilanlarındaki teklifleri gösterir
    { href: `${base}/teklifler`, label: "Teklifler" },
    { href: `${base}/kategoriler`, label: "Kategoriler" },
    { href: `${base}/demo-ilanlar`, label: "Demo ilanlar" },
    { href: `${base}/icerik`, label: "İçerik" },
    { href: `${base}/reklam`, label: "Reklam alanları" },
    ...(extras || []),
    { href: `${base}/ayarlar`, label: "Ayarlar" },
  ];
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(true);
  const [adminName, setAdminName] = useState("Admin");
  const [adminPhone, setAdminPhone] = useState("");
  const [msgCount, setMsgCount] = useState(0);
  const [sellerRequestCount, setSellerRequestCount] = useState(0);
  const [commercialPendingCount, setCommercialPendingCount] = useState(0);
  const [verticalCounts, setVerticalCounts] = useState<
    Record<string, { pending: number; edit: number; extension: number }>
  >({
    "emlak-vasita": { pending: 0, edit: 0, extension: 0 },
    alisveris: { pending: 0, edit: 0, extension: 0 },
    premium: { pending: 0, edit: 0, extension: 0 },
  });
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    "emlak-vasita": pathname.startsWith("/admin/emlak-vasita"),
    alisveris: pathname.startsWith("/admin/alisveris"),
    premium: pathname.startsWith("/admin/premium"),
    kullanicilar:
      pathname.startsWith("/admin/kullanicilar") ||
      pathname.startsWith("/admin/ticari-uyeler") ||
      pathname.startsWith("/admin/yorumlar") ||
      pathname.startsWith("/admin/satici-talepleri"),
    odemeler:
      pathname.startsWith("/admin/odemeler") ||
      pathname.startsWith("/admin/kurumsal") ||
      pathname.startsWith("/admin/jeton") ||
      pathname.startsWith("/admin/iade-jetonlar") ||
      pathname.startsWith("/admin/guvenli-ode"),
    gelirler: pathname.startsWith("/admin/gelirler"),
    raporlar: pathname.startsWith("/admin/raporlar"),
    ayarlar: pathname.startsWith("/admin/ayarlar"),
    "satici-paneli": pathname.startsWith("/admin/satici-paneli"),
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin?view=nav")
      .then(async (r) => {
        if (r.status === 401 || r.status === 403) {
          router.replace("/giris");
          return null;
        }
        return r.json();
      })
      .then((d) => {
        if (!d || cancelled) return;
        setAdminName(d.adminUser?.name || "Sistem Admin");
        setAdminPhone(d.adminUser?.phone || "");
        setMsgCount(d.kpis?.unreadMessages || 0);
        setSellerRequestCount(d.kpis?.pendingSellerRequestCount || 0);
        setCommercialPendingCount(d.kpis?.pendingCommercialUserCount || 0);
        const bv = d.kpis?.byVertical;
        if (bv && typeof bv === "object") {
          setVerticalCounts({
            "emlak-vasita": {
              pending: Number(bv["emlak-vasita"]?.pending || 0),
              edit: Number(bv["emlak-vasita"]?.edit || 0),
              extension: Number(bv["emlak-vasita"]?.extension || 0),
            },
            alisveris: {
              pending: Number(bv.alisveris?.pending || 0),
              edit: Number(bv.alisveris?.edit || 0),
              extension: Number(bv.alisveris?.extension || 0),
            },
            premium: {
              pending: Number(bv.premium?.pending || 0),
              edit: Number(bv.premium?.edit || 0),
              extension: Number(bv.premium?.extension || 0),
            },
          });
        }
      })
      .catch(() => {
        if (!cancelled) router.replace("/giris");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    setUserMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    setOpenMenus((m) => ({
      ...m,
      "emlak-vasita": pathname.startsWith("/admin/emlak-vasita") ? true : m["emlak-vasita"],
      alisveris: pathname.startsWith("/admin/alisveris") ? true : m.alisveris,
      premium: pathname.startsWith("/admin/premium") ? true : m.premium,
      kullanicilar:
        pathname.startsWith("/admin/kullanicilar") ||
        pathname.startsWith("/admin/ticari-uyeler") ||
        pathname.startsWith("/admin/yorumlar") ||
        pathname.startsWith("/admin/satici-talepleri")
          ? true
          : m.kullanicilar,
      odemeler:
        pathname.startsWith("/admin/odemeler") ||
        pathname.startsWith("/admin/kurumsal") ||
        pathname.startsWith("/admin/jeton") ||
        pathname.startsWith("/admin/iade-jetonlar") ||
        pathname.startsWith("/admin/guvenli-ode")
          ? true
          : m.odemeler,
      gelirler: pathname.startsWith("/admin/gelirler") ? true : m.gelirler,
      raporlar: pathname.startsWith("/admin/raporlar") ? true : m.raporlar,
      ayarlar: pathname.startsWith("/admin/ayarlar") ? true : m.ayarlar,
      "satici-paneli": pathname.startsWith("/admin/satici-paneli") ? true : m["satici-paneli"],
    }));
  }, [pathname]);

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

  const vEmlak = verticalCounts["emlak-vasita"];
  const vAlisveris = verticalCounts.alisveris;
  const vPremium = verticalCounts.premium;
  function verticalBadgeSum(c: { pending: number; edit: number; extension: number }) {
    const n = c.pending + c.edit + c.extension;
    return n > 0 ? n : undefined;
  }

  const usersMenuBadge =
    (sellerRequestCount || 0) + (commercialPendingCount || 0) > 0
      ? (sellerRequestCount || 0) + (commercialPendingCount || 0)
      : undefined;
  const bellCount = (msgCount || 0) + (commercialPendingCount || 0) + (sellerRequestCount || 0);

  const nav: NavItem[] = [
    { href: "/admin", label: "Genel Bakış", icon: <LayoutDashboard size={18} /> },
    {
      href: "/admin/emlak-vasita",
      label: "Vasıta & Emlak",
      icon: (
        <span style={{ display: "inline-flex", gap: 2 }}>
          <Building2 size={16} />
          <Car size={16} />
        </span>
      ),
      menuKey: "emlak-vasita",
      badge: verticalBadgeSum(vEmlak),
      children: verticalChildren("/admin/emlak-vasita", vEmlak),
    },
    {
      href: "/admin/alisveris",
      label: "Alışveriş",
      icon: <ShoppingBag size={18} />,
      menuKey: "alisveris",
      badge: verticalBadgeSum(vAlisveris),
      children: verticalChildren("/admin/alisveris", vAlisveris, [
        { href: "/admin/alisveris/siparisler", label: "Siparişler" },
        { href: "/admin/alisveris/magaza-paketleri", label: "Mağaza paketleri" },
        { href: "/admin/alisveris/abonelikler", label: "Abonelikler" },
        { href: "/admin/alisveris/markalar", label: "Markalar" },
        { href: "/admin/alisveris/modeller", label: "Modeller" },
        { href: "/admin/alisveris/ozellikler", label: "Özellikler" },
        { href: "/admin/alisveris/kategori-markalari", label: "Kategori markaları" },
        { href: "/admin/alisveris/kategori-modelleri", label: "Kategori modelleri" },
        { href: "/admin/alisveris/kategori-ozellikleri", label: "Kategori özellikleri" },
        { href: "/admin/alisveris/katalog-urunleri", label: "Katalog ürünleri" },
        { href: "/admin/alisveris/urun-talepleri", label: "Ürün talepleri" },
        { href: "/admin/alisveris/katalog-teklifler", label: "SellerOffer listesi" },
        { href: "/admin/alisveris/duplicate-urunler", label: "Duplicate / barkod" },
      ]),
    },
    {
      href: "/admin/premium",
      label: "Premium",
      icon: <Hotel size={18} />,
      menuKey: "premium",
      badge: verticalBadgeSum(vPremium),
      children: verticalChildren("/admin/premium", vPremium),
    },
    {
      href: "/admin/satici-paneli",
      label: "Satıcı paneli",
      icon: <Store size={18} />,
      menuKey: "satici-paneli",
      children: [
        { href: "/admin/satici-paneli", label: "Özet" },
        { href: "/admin/satici-paneli/siparisler", label: "Sipariş & kargo" },
        { href: "/admin/satici-paneli/sorular", label: "Soru–cevap" },
        { href: "/admin/satici-paneli/ayarlar", label: "Ayarlar" },
      ],
    },
    {
      href: "/admin/kullanicilar",
      label: "Kullanıcılar",
      icon: <Users size={18} />,
      menuKey: "kullanicilar",
      badge: usersMenuBadge,
      children: [
        { href: "/admin/kullanicilar", label: "Tüm Kullanıcılar" },
        {
          href: "/admin/ticari-uyeler",
          label: "Kurumsal Onay",
          badge: commercialPendingCount > 0 ? commercialPendingCount : undefined,
        },
        { href: "/admin/yorumlar", label: "Satıcı Yorumları" },
        {
          href: "/admin/satici-talepleri",
          label: "Satıcı Talepleri",
          badge: sellerRequestCount > 0 ? sellerRequestCount : undefined,
        },
        { href: "/admin/kullanicilar/ayarlar", label: "Ayarlar" },
      ],
    },
    {
      href: "/admin/mesajlar",
      label: "Mesajlar",
      icon: <MessageSquare size={18} />,
      badge: msgCount > 0 ? msgCount : undefined,
    },
    {
      href: "/admin/odemeler",
      label: "Ödemeler",
      icon: <CreditCard size={18} />,
      menuKey: "odemeler",
      children: [
        { href: "/admin/odemeler", label: "Ödeme Kayıtları" },
        { href: "/admin/guvenli-ode", label: "Güvenli Öde / GET Havuzu" },
        { href: "/admin/jeton", label: "Jeton Paketleri" },
        { href: "/admin/iade-jetonlar", label: "İade Jetonlar" },
        { href: "/admin/kurumsal", label: "Kurumsal Paketler" },
        { href: "/admin/odemeler/altyapi", label: "Altyapı" },
        { href: "/admin/odemeler/ayarlar", label: "Ayarlar" },
      ],
    },
    {
      href: "/admin/gelirler",
      label: "Gelirler",
      icon: <Wallet size={18} />,
      menuKey: "gelirler",
      children: [{ href: "/admin/gelirler", label: "Gelir Özeti" }],
    },
    { href: "/admin/reklam", label: "Reklam", icon: <Megaphone size={18} /> },
    { href: "/admin/ai", label: "AI", icon: <Sparkles size={18} /> },
    {
      href: "/admin/raporlar",
      label: "Raporlar",
      icon: <BarChart3 size={18} />,
      menuKey: "raporlar",
      children: [{ href: "/admin/raporlar", label: "Özet Rapor" }],
    },
    { href: "/admin/kullanici-ayarlari", label: "Kullanıcı ayarları", icon: <UserCog size={18} /> },
    { href: "/admin/tema", label: "Tema", icon: <Palette size={18} /> },
    { href: "/admin/footer", label: "Footer", icon: <PanelBottom size={18} /> },
    {
      href: "/admin/ayarlar",
      label: "Sistem ayarları",
      icon: <Settings size={18} />,
      menuKey: "ayarlar",
      children: [{ href: "/admin/ayarlar", label: "Genel" }],
    },
    { href: "/admin/loglar", label: "Log", icon: <ScrollText size={18} /> },
  ];

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    if (
      href === "/admin/emlak-vasita" ||
      href === "/admin/alisveris" ||
      href === "/admin/premium" ||
      href === "/admin/satici-paneli" ||
      href === "/admin/kullanicilar" ||
      href === "/admin/odemeler" ||
      href === "/admin/gelirler" ||
      href === "/admin/raporlar"
    ) {
      return pathname === href || pathname.startsWith(href + "/");
    }
    return pathname === href || pathname.startsWith(href + "/");
  }

  function childActive(href: string) {
    if (
      href === "/admin/kullanicilar" ||
      href === "/admin/odemeler" ||
      href === "/admin/ayarlar" ||
      href === "/admin/satici-paneli"
    ) {
      return pathname === href;
    }
    return pathname === href;
  }

  function toggleMenu(key: string) {
    setOpenMenus((m) => ({ ...m, [key]: !m[key] }));
  }

  if (!ready) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f4f6f9" }}>
        Admin yükleniyor...
      </div>
    );
  }

  return (
    <div className="adm-root">
      <aside className="adm-sidebar">
        <div className="adm-brand">
          <span className="adm-brand-mark">⋮⋮</span>
          <span>
            Teklif<span>Bu</span>
          </span>
        </div>

        <nav className="adm-nav">
          {nav.map((item) => {
            const active = isActive(item.href);
            const menuKey = item.menuKey || "";
            const expanded = menuKey ? openMenus[menuKey] : false;

            return (
              <div key={item.href + item.label} className="adm-nav-block">
                {item.children ? (
                  <>
                    <button
                      type="button"
                      className={`adm-nav-item ${active ? "active" : ""}`}
                      onClick={() => {
                        toggleMenu(menuKey);
                        router.push(item.href);
                      }}
                    >
                      <span className="adm-nav-ico">{item.icon}</span>
                      <span className="adm-nav-label">{item.label}</span>
                      {item.badge ? <span className="adm-badge">{item.badge}</span> : null}
                      <span className="adm-nav-chev">
                        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </span>
                    </button>
                    {expanded && (
                      <div className="adm-subnav">
                        {item.children.map((c) => (
                          <Link
                            key={c.href + c.label}
                            href={c.href}
                            className={childActive(c.href) ? "active" : ""}
                          >
                            <span>{c.label}</span>
                            {c.badge ? <span className="adm-badge adm-badge-sm">{c.badge}</span> : null}
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <Link href={item.href} className={`adm-nav-item ${active ? "active" : ""}`}>
                    <span className="adm-nav-ico">{item.icon}</span>
                    <span className="adm-nav-label">{item.label}</span>
                    {item.badge ? <span className="adm-badge">{item.badge}</span> : null}
                  </Link>
                )}
              </div>
            );
          })}
        </nav>

        <div className="adm-promo">
          <div className="adm-promo-title">TeklifBu Mobil Uygulaması</div>
          <p>Her yerden ilan ve teklif yönetimi.</p>
          <div className="adm-promo-stores">
            <span>App Store</span>
            <span>Google Play</span>
          </div>
          <div className="adm-promo-phone" aria-hidden />
        </div>
      </aside>

      <div className="adm-main">
        <header className="adm-topbar">
          <div className="adm-search">
            <Search size={16} />
            <input placeholder="Ara..." />
            <kbd>⌘K</kbd>
          </div>
          <div className="adm-top-actions">
            <button type="button" className="adm-icon-btn" aria-label="Tema">
              <Sun size={18} />
            </button>
            <Link
              href={
                commercialPendingCount > 0
                  ? "/admin/ticari-uyeler"
                  : sellerRequestCount > 0
                    ? "/admin/satici-talepleri"
                    : "/admin/mesajlar"
              }
              className="adm-icon-btn"
              aria-label="Bildirimler"
              title={
                commercialPendingCount > 0
                  ? `${commercialPendingCount} kurumsal onay bekliyor`
                  : sellerRequestCount > 0
                    ? `${sellerRequestCount} satıcı talebi`
                    : "Mesajlar"
              }
            >
              <Bell size={18} />
              {bellCount > 0 ? <span className="adm-dot">{bellCount}</span> : null}
            </Link>
            <button type="button" className="adm-icon-btn" aria-label="Yardım">
              <HelpCircle size={18} />
            </button>
            <div className="adm-user-wrap">
              <button
                type="button"
                className="adm-user"
                onClick={() => setUserMenuOpen((v) => !v)}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
              >
                <div className="adm-avatar">{adminName.slice(0, 1).toUpperCase()}</div>
                <div>
                  <div className="adm-user-name">{adminName}</div>
                  <div className="adm-user-role">Admin</div>
                </div>
                <ChevronDown
                  size={14}
                  style={{
                    opacity: 0.6,
                    transform: userMenuOpen ? "rotate(180deg)" : undefined,
                    transition: "transform .15s",
                  }}
                />
              </button>
              {userMenuOpen && (
                <div className="adm-user-menu" role="menu">
                  <div className="adm-user-menu-head">
                    <strong>{adminName}</strong>
                    {adminPhone && <span>{adminPhone}</span>}
                  </div>
                  <Link href="/admin/hesap" role="menuitem" onClick={() => setUserMenuOpen(false)}>
                    <UserRound size={15} /> Hesabım
                  </Link>
                  <Link href="/admin/ayarlar" role="menuitem" onClick={() => setUserMenuOpen(false)}>
                    <Settings size={15} /> Sistem Ayarları
                  </Link>
                  <Link href="/" role="menuitem" onClick={() => setUserMenuOpen(false)}>
                    <ExternalLink size={15} /> Siteye Dön
                  </Link>
                  <button type="button" role="menuitem" className="adm-logout-btn" onClick={logout}>
                    <LogOut size={15} /> Çıkış Yap
                  </button>
                </div>
              )}
            </div>
            <Link href="/" className="adm-site-link" title="Siteye dön">
              <ExternalLink size={16} />
            </Link>
          </div>
        </header>
        <div className="adm-content">{children}</div>
      </div>
    </div>
  );
}
