"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type CartItem = {
  listingId: string;
  title: string;
  price: number;
  image?: string | null;
  qty: number;
};

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  totalTl: number;
  addItem: (item: Omit<CartItem, "qty"> & { qty?: number }) => void;
  removeItem: (listingId: string) => void;
  setQty: (listingId: string, qty: number) => void;
  clear: () => void;
};

type SurfaceContextValue = {
  shoppingSurface: boolean;
  setShoppingSurface: (v: boolean) => void;
};

const STORAGE_KEY = "teklifbu:cart:v1";

const CartContext = createContext<CartContextValue | null>(null);
const SurfaceContext = createContext<SurfaceContextValue>({
  shoppingSurface: false,
  setShoppingSurface: () => {},
});

function loadCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => x && typeof x.listingId === "string" && Number.isFinite(Number(x.price)))
      .map((x) => ({
        listingId: x.listingId,
        title: String(x.title || "Ürün"),
        price: Number(x.price) || 0,
        image: x.image ?? null,
        qty: Math.max(1, Math.min(99, Number(x.qty) || 1)),
      }));
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [shoppingSurface, setShoppingSurface] = useState(false);

  useEffect(() => {
    setItems(loadCart());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore quota */
    }
  }, [items, hydrated]);

  const addItem = useCallback((item: Omit<CartItem, "qty"> & { qty?: number }) => {
    const qty = Math.max(1, Math.min(99, item.qty ?? 1));
    setItems((prev) => {
      const i = prev.findIndex((x) => x.listingId === item.listingId);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty: Math.min(99, next[i].qty + qty), title: item.title, price: item.price, image: item.image };
        return next;
      }
      return [...prev, { listingId: item.listingId, title: item.title, price: item.price, image: item.image ?? null, qty }];
    });
  }, []);

  const removeItem = useCallback((listingId: string) => {
    setItems((prev) => prev.filter((x) => x.listingId !== listingId));
  }, []);

  const setQty = useCallback((listingId: string, qty: number) => {
    const q = Math.floor(qty);
    if (q <= 0) {
      setItems((prev) => prev.filter((x) => x.listingId !== listingId));
      return;
    }
    setItems((prev) =>
      prev.map((x) => (x.listingId === listingId ? { ...x, qty: Math.min(99, q) } : x))
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const itemCount = useMemo(() => items.reduce((s, x) => s + x.qty, 0), [items]);
  const totalTl = useMemo(() => items.reduce((s, x) => s + x.price * x.qty, 0), [items]);

  const cartValue = useMemo(
    () => ({ items, itemCount, totalTl, addItem, removeItem, setQty, clear }),
    [items, itemCount, totalTl, addItem, removeItem, setQty, clear]
  );

  const surfaceValue = useMemo(
    () => ({ shoppingSurface, setShoppingSurface }),
    [shoppingSurface]
  );

  return (
    <SurfaceContext.Provider value={surfaceValue}>
      <CartContext.Provider value={cartValue}>{children}</CartContext.Provider>
    </SurfaceContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

export function useShoppingSurfaceFlag() {
  return useContext(SurfaceContext);
}

/** Alışveriş sayfası / PDP açıkken header sepet + favori ikon modunu açar. */
export function useRegisterShoppingSurface(active = true) {
  const { setShoppingSurface } = useShoppingSurfaceFlag();
  useEffect(() => {
    if (!active) return;
    setShoppingSurface(true);
    return () => setShoppingSurface(false);
  }, [active, setShoppingSurface]);
}
