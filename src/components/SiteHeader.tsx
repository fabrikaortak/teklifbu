"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Bell,
  Heart,
  UserRound,
  Plus,
  ChevronDown,
  Search,
  LayoutDashboard,
  FileText,
  Gavel,
  ShoppingBag,
  Coins,
  MessagesSquare,
  ShieldCheck,
  Settings,
  LogOut,
  Shield,
} from "lucide-react";
import { AuthModal } from "@/components/AuthModal";
import { BrandLogo } from "@/components/BrandLogo";
import { getCatIcon } from "@/components/CategoryIcons";
import { useTheme } from "@/components/ThemeProvider";
import { useShoppingSurfaceFlag } from "@/components/cart/CartProvider";
import { ShoppingCartControl } from "@/components/cart/ShoppingCartControl";
import { formatCompact } from "@/lib/format";

type User = {
  id: string;
  name: string | null;
  phone: string;
  role: string;
  tokenBalance: number;
  avatarUrl?: string | null;
  accountType?: string | null;
};

type Cat = { slug: string; name: string; _count?: { listings: number } };

type MenuItem = { href: string; label: string; icon: ReactNode; badge?: number | null };

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, shoppingCartPlacement, offersEnabled, escrow } = useTheme();
  const { shoppingSurface } = useShoppingSurfaceFlag();
  const isShopNav = shoppingSurface || Boolean(pathname?.startsWith("/alisveris")) || pathname === "/sepet";
  const showHeaderCart = isShopNav && shoppingCartPlacement === "ust";
  const [user, setUser] = useState<User | null>(null);
  const [unread, setUnread] = useState(0);
  const [authOpen, setAuthOpen] = useState(false);
  const [authIntent, setAuthIntent] = useState<"login" | "favorite">("login");
  const [loaded, setLoaded] = useState(false);
  const [categories, setCategories] = useState<Cat[]>([]);
  const [catsOpen, setCatsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [headerQ, setHeaderQ] = useState("");
  const catsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  async function refreshAuth() {
    const d = await fetch("/api/auth").then((r) => r.json());
    setUser(d.user);
    setLoaded(true);
    if (d.user) {
      const me = await fetch("/api/me").then((r) => (r.ok ? r.json() : null));
      if (me?.user) {
        setUser({
          ...d.user,
          name: me.user.name ?? d.user.name,
          tokenBalance: me.user.tokenBalance ?? d.user.tokenBalance ?? 0,
          avatarUrl: me.user.avatarUrl ?? d.user.avatarUrl ?? null,
          accountType: me.user.accountType ?? d.user.accountType,
        });
      }
      if (me?.notifications) {
        setUnread(me.notifications.filter((n: { isRead: boolean }) => !n.isRead).length);
      }
    } else {
      setUnread(0);
    }
  }

  useEffect(() => {
    refreshAuth();
    const onAuth = () => refreshAuth();
    window.addEventListener("teklifbu:auth", onAuth);
    return () => window.removeEventListener("teklifbu:auth", onAuth);
  }, []);

  useEffect(() => {
    setCatsOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    fetch("/api/listings")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories || []))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!catsRef.current?.contains(e.target as Node)) setCatsOpen(false);
      if (!userMenuRef.current?.contains(e.target as Node)) setUserMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setCatsOpen(false);
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const userMenuItems = useMemo<MenuItem[]>(() => {
    if (!user) return [];
    const items: MenuItem[] = [
      { href: "/hesabim", label: "Ana Sayfa", icon: <LayoutDashboard size={15} /> },
      { href: "/hesabim?s=ilanlarim", label: "İlanlarım", icon: <FileText size={15} /> },
    ];
    if (offersEnabled) {
      items.push({ href: "/hesabim?s=tekliflerim", label: "Tekliflerim", icon: <Gavel size={15} /> });
    }
    items.push(
      { href: "/hesabim?s=alisveris", label: "Alışverişlerim", icon: <ShoppingBag size={15} /> },
      { href: "/hesabim?s=favoriler", label: "Favorilerim", icon: <Heart size={15} /> },
      { href: "/hesabim?s=mesajlar", label: "Mesajlarım", icon: <MessagesSquare size={15} /> },
      {
        href: "/hesabim?s=jetonlarim",
        label: "Jetonlarım",
        icon: <Coins size={15} />,
        badge: user.tokenBalance ?? 0,
      },
      {
        href: "/hesabim?s=bildirimler",
        label: "Bildirimlerim",
        icon: <Bell size={15} />,
        badge: unread || null,
      }
    );
    if (escrow?.enabled) {
      items.push({ href: "/hesabim?s=guvenli-ode", label: "Güvenli Öde", icon: <ShieldCheck size={15} /> });
    }
    items.push(
      { href: "/hesabim?s=ayarlar", label: "Ayarlarım", icon: <Settings size={15} /> },
      { href: "/hesabim?s=guvenlik", label: "Güvenlik", icon: <Shield size={15} /> }
    );
    if (user.role === "ADMIN" || user.role === "STAFF") {
      items.unshift({ href: "/admin", label: "Yönetim Paneli", icon: <Shield size={15} /> });
    }
    return items;
  }, [user, offersEnabled, escrow?.enabled, unread]);

  async function logout() {
    setUserMenuOpen(false);
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    window.dispatchEvent(new Event("teklifbu:auth"));
    router.push("/");
    router.refresh();
  }

  if (pathname?.startsWith("/admin")) return null;

  function openAuth(intent: "login" | "favorite" = "login") {
    setAuthIntent(intent);
    setAuthOpen(true);
  }

  function openFavorites() {
    if (!loaded) return;
    if (!user) {
      openAuth("favorite");
      return;
    }
    router.push("/hesabim?s=favoriler");
  }

  function submitHeaderSearch(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (headerQ.trim()) params.set("q", headerQ.trim());
    router.push(isShopNav ? `/alisveris?${params.toString()}` : `/ilanlar?${params.toString()}`);
  }

  const displayName = (user?.name || "Hesabım").toLocaleUpperCase("tr-TR");
  const jetonLabel = `JETON: ${formatCompact(user?.tokenBalance ?? 0)}`;
  const cartControl = showHeaderCart ? <ShoppingCartControl variant="header" /> : null;

  const userMenuPanel = user ? (
    <div className={`hdr-user-menu${userMenuOpen ? " is-open" : ""}`} role="menu">
      <div className="hdr-user-menu__head">
        <span className="hdr-user-menu__avatar" aria-hidden>
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt="" />
          ) : (
            <UserRound size={18} strokeWidth={1.5} />
          )}
        </span>
        <div>
          <strong>{user.name || "Kullanıcı"}</strong>
          <span>{jetonLabel}</span>
        </div>
      </div>
      <div className="hdr-user-menu__list">
        {userMenuItems.map((item) => (
          <Link
            key={item.href + item.label}
            href={item.href}
            className="hdr-user-menu__item"
            role="menuitem"
            onClick={() => setUserMenuOpen(false)}
          >
            <span className="hdr-user-menu__ico">{item.icon}</span>
            <span className="hdr-user-menu__label">{item.label}</span>
            {item.badge != null && item.badge !== 0 ? (
              <span className="hdr-user-menu__badge">{item.badge}</span>
            ) : null}
          </Link>
        ))}
      </div>
      <button type="button" className="hdr-user-menu__logout" onClick={logout}>
        <LogOut size={15} /> Çıkış Yap
      </button>
    </div>
  ) : null;

  const authModal = (
    <AuthModal
      open={authOpen}
      onClose={() => setAuthOpen(false)}
      title={
        authIntent === "favorite"
          ? "Üye olmadan favorilerinizi göremezsiniz"
          : "Giriş yapın veya üye olun"
      }
      subtitle={
        authIntent === "favorite"
          ? "Favoriler menüsüne girmek için telefon/e-posta ve şifrenizle giriş yapın veya üye olun."
          : "Üyeler telefon veya e-posta + şifre ile giriş yapar. Yeni üyelikte OTP ile telefon doğrulanır."
      }
      onSuccess={async () => {
        await refreshAuth();
        window.dispatchEvent(new Event("teklifbu:auth"));
        if (authIntent === "favorite") {
          router.push("/hesabim?s=favoriler");
        }
      }}
    />
  );

  if (theme === "v2") {
    return (
      <>
        <header className="v2-header">
          <div className="v2-header-inner">
            <Link href="/" className="v2-logo" prefetch aria-label="Anasayfa">
              <BrandLogo />
            </Link>

            <form className="v2-search" onSubmit={submitHeaderSearch}>
              <input
                type="search"
                value={headerQ}
                onChange={(e) => setHeaderQ(e.target.value)}
                placeholder="Kelime, ilan no veya mağaza adı ile ara..."
                aria-label="Ara"
              />
              <button type="submit" className="v2-search-btn" aria-label="Ara">
                <Search size={18} strokeWidth={2.5} />
              </button>
            </form>

            <div className="v2-header-actions">
              {user ? (
                <button type="button" onClick={openFavorites} aria-label="Favorilerim" title="Favorilerim">
                  <Heart size={17} strokeWidth={1.75} />
                </button>
              ) : null}
              {user ? (
                <Link href="/hesabim?s=bildirimler" aria-label="Bildirimler" className="v2-msg-link">
                  <span className="v2-msg-ico">
                    <Bell size={18} strokeWidth={1.75} />
                    {unread > 0 && <span className="v2-badge">{unread > 9 ? "9+" : unread}</span>}
                  </span>
                </Link>
              ) : null}
              {cartControl}
              {user ? (
                <div className="hdr-user-wrap" ref={userMenuRef}>
                  <button
                    type="button"
                    className={`v2-user-link hdr-user-trigger${userMenuOpen ? " is-open" : ""}`}
                    title={displayName}
                    aria-expanded={userMenuOpen}
                    aria-haspopup="menu"
                    onClick={() => setUserMenuOpen((v) => !v)}
                  >
                    <span className="v2-avatar" aria-hidden>
                      {user.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={user.avatarUrl} alt="" className="v2-avatar-img" />
                      ) : (
                        <UserRound size={22} strokeWidth={1.5} className="v2-avatar-ico" />
                      )}
                    </span>
                    <span className="v2-user-meta hide-mobile">
                      <span className="v2-user-name">{displayName}</span>
                      <span className="v2-user-jeton">{jetonLabel}</span>
                    </span>
                    <ChevronDown size={14} className="hdr-user-chevron hide-mobile" />
                  </button>
                  {userMenuPanel}
                </div>
              ) : (
                <button type="button" onClick={() => openAuth("login")}>
                  <UserRound size={16} /> Giriş Yap
                </button>
              )}
              <Link href="/ilan-ver" className="v2-ilan-ver">
                <Plus size={15} strokeWidth={2.5} /> İlan Ver
              </Link>
            </div>
          </div>
        </header>
        {authModal}
      </>
    );
  }

  return (
    <>
      <header style={{ background: "var(--navy)", color: "white", position: "relative", zIndex: 100 }}>
        <div
          className="page-shell"
          style={{
            paddingTop: 10,
            paddingBottom: 10,
            display: "flex",
            alignItems: "center",
            gap: 24,
          }}
        >
          <Link href="/" style={{ fontWeight: 800, fontSize: 32, letterSpacing: -0.3 }}>
            <BrandLogo />
          </Link>

          <nav
            style={{
              display: "flex",
              gap: 18,
              flex: 1,
              fontSize: 14,
              fontWeight: 600,
              opacity: 0.95,
              alignItems: "center",
            }}
            className="hide-mobile"
          >
            <Link href="/">Ana Sayfa</Link>
            <Link href="/ilanlar">İlanlar</Link>

            <div ref={catsRef} style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setCatsOpen((v) => !v)}
                aria-expanded={catsOpen}
                aria-haspopup="menu"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  background: "transparent",
                  border: "none",
                  color: "inherit",
                  font: "inherit",
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Kategoriler
                <ChevronDown size={14} style={{ transform: catsOpen ? "rotate(180deg)" : undefined, transition: "transform .15s" }} />
              </button>

              {catsOpen && (
                <div
                  role="menu"
                  className="header-cats-menu"
                  style={{
                    position: "absolute",
                    top: "calc(100% + 12px)",
                    left: 0,
                    minWidth: 280,
                    background: "#fff",
                    color: "#0f172a",
                    borderRadius: 14,
                    border: "1px solid #e5e7eb",
                    boxShadow: "0 16px 40px rgba(15,23,42,.18)",
                    padding: 8,
                    zIndex: 200,
                  }}
                >
                  <Link
                    href="/ilanlar"
                    role="menuitem"
                    onClick={() => setCatsOpen(false)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 12px",
                      borderRadius: 10,
                      fontWeight: 700,
                      fontSize: 13,
                      color: "var(--orange)",
                    }}
                  >
                    Tüm İlanlar
                    <span style={{ color: "#94a3b8", fontWeight: 600 }}>→</span>
                  </Link>
                  <div style={{ height: 1, background: "#f1f5f9", margin: "4px 8px" }} />
                  {categories.map((c) => (
                    <Link
                      key={c.slug}
                      href={`/ilanlar?category=${c.slug}`}
                      role="menuitem"
                      onClick={() => setCatsOpen(false)}
                      className="header-cat-item"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 12px",
                        borderRadius: 10,
                        fontWeight: 600,
                        fontSize: 13.5,
                      }}
                    >
                      <span style={{ display: "grid", placeItems: "center", width: 28, height: 28 }}>{getCatIcon(c.slug, 22)}</span>
                      <span style={{ flex: 1 }}>{c.name}</span>
                      <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>{c._count?.listings ?? 0}</span>
                    </Link>
                  ))}
                  {!categories.length && (
                    <div style={{ padding: 12, color: "#94a3b8", fontSize: 13 }}>Kategoriler yükleniyor…</div>
                  )}
                </div>
              )}
            </div>

            <Link href="/nasil-calisir">Nasıl Çalışır?</Link>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              Kurumsal <ChevronDown size={14} />
            </span>
            <Link href="/yardim">Yardım</Link>
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: 14, marginLeft: "auto" }}>
            <Link
              href="/ilan-ver"
              className="btn-orange"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 14px", fontSize: 14 }}
            >
              <Plus size={16} /> İlan Ver
            </Link>
            {user ? (
              <button
                type="button"
                onClick={openFavorites}
                aria-label="Favorilerim"
                title="Favorilerim"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                  background: "transparent",
                  border: "none",
                  color: "inherit",
                  cursor: "pointer",
                  padding: 0,
                  fontWeight: 600,
                }}
              >
                <Heart size={16} />
              </button>
            ) : null}
            {user ? (
              <Link href="/hesabim?s=bildirimler" style={{ position: "relative", display: "inline-flex" }}>
                <Bell size={18} />
                {unread > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: -6,
                      right: -8,
                      background: "#ef4444",
                      color: "white",
                      borderRadius: 999,
                      fontSize: 10,
                      fontWeight: 700,
                      minWidth: 16,
                      height: 16,
                      display: "grid",
                      placeItems: "center",
                      padding: "0 4px",
                    }}
                  >
                    {unread}
                  </span>
                )}
              </Link>
            ) : null}
            {cartControl}
            {user ? (
              <div className="hdr-user-wrap" ref={userMenuRef}>
                <button
                  type="button"
                  className={`hdr-user-trigger${userMenuOpen ? " is-open" : ""}`}
                  title={displayName}
                  aria-expanded={userMenuOpen}
                  aria-haspopup="menu"
                  onClick={() => setUserMenuOpen((v) => !v)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 12,
                    lineHeight: 1.15,
                    background: "transparent",
                    border: "none",
                    color: "inherit",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  <span
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: "#e8eaed",
                      display: "grid",
                      placeItems: "center",
                      overflow: "hidden",
                      flexShrink: 0,
                      color: "#9aa0a6",
                    }}
                    aria-hidden
                  >
                    {user.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <UserRound size={20} strokeWidth={1.5} />
                    )}
                  </span>
                  <span className="hide-mobile" style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-start" }}>
                    <span style={{ fontWeight: 800, color: "#fff", textTransform: "uppercase" }}>{displayName}</span>
                    <span style={{ fontWeight: 800, color: "var(--orange, #ff6600)", textTransform: "uppercase" }}>{jetonLabel}</span>
                  </span>
                  <ChevronDown size={14} className="hide-mobile" style={{ opacity: 0.85 }} />
                </button>
                {userMenuPanel}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => openAuth("login")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                  background: "transparent",
                  border: "none",
                  color: "inherit",
                  cursor: "pointer",
                  padding: 0,
                  fontWeight: 600,
                }}
              >
                <UserRound size={16} /> Giriş Yap
              </button>
            )}
          </div>
        </div>
      </header>
      {authModal}
    </>
  );
}
