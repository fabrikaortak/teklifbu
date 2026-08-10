"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/components/cart/CartProvider";
import { cartItemHref } from "@/lib/cartItemHref";
import { formatTl } from "@/lib/format";

type Props = {
  /** header: üst kuşak (koyu zemin) · strip: kategori satırı (açık zemin) */
  variant?: "header" | "strip";
  className?: string;
};

export function ShoppingCartControl({ variant = "header", className }: Props) {
  const { items, itemCount, totalTl, removeItem } = useCart();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const countLabel = `${itemCount} ürün`;
  const totalLabel = formatTl(totalTl, { fractionDigits: 2 });
  const isStrip = variant === "strip";
  const rootClass = isStrip
    ? `v2-cart-link v2-cart-link--strip${className ? ` ${className}` : ""}`
    : `v2-cart-link${className ? ` ${className}` : ""}`;

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const trigger = isStrip ? (
    <>
      <span className="v2-cart-ico v2-cart-ico--strip" aria-hidden>
        <ShoppingCart size={18} strokeWidth={2} />
        {itemCount > 0 && (
          <span className="v2-badge v2-badge--strip">{itemCount > 9 ? "9+" : itemCount}</span>
        )}
      </span>
      <span className="v2-cart-strip-total">{totalLabel}</span>
    </>
  ) : (
    <>
      <span className="v2-cart-ico" aria-hidden>
        <ShoppingCart size={18} strokeWidth={1.75} />
        {itemCount > 0 && <span className="v2-badge">{itemCount > 9 ? "9+" : itemCount}</span>}
      </span>
      <span className="v2-cart-meta hide-mobile">
        <span className="v2-cart-count">{countLabel}</span>
        <span className="v2-cart-total">{totalLabel}</span>
      </span>
    </>
  );

  return (
    <div
      ref={wrapRef}
      className={`v2-cart-wrap${isStrip ? " v2-cart-wrap--strip" : " v2-cart-wrap--header"}${open ? " is-open" : ""}`}
    >
      <button
        type="button"
        className={rootClass}
        title="Sepet"
        aria-label={`Sepet: ${countLabel}, ${totalLabel}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        {trigger}
      </button>

      {open ? (
        <div className="v2-cart-dropdown" role="dialog" aria-label="Sepet içeriği">
          <div className="v2-cart-dropdown-head">
            <strong>Sepetim</strong>
            <span>
              {countLabel} · {totalLabel}
            </span>
          </div>

          {!items.length ? (
            <div className="v2-cart-dropdown-empty">Sepetiniz boş</div>
          ) : (
            <ul className="v2-cart-dropdown-list">
              {items.map((item) => (
                <li key={item.listingId}>
                  <Link
                    href={cartItemHref(item.listingId)}
                    className="v2-cart-dropdown-item"
                    onClick={() => setOpen(false)}
                  >
                    <span className="v2-cart-dropdown-thumb">
                      {item.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.image} alt="" />
                      ) : null}
                    </span>
                    <span className="v2-cart-dropdown-info">
                      <span className="v2-cart-dropdown-title">{item.title}</span>
                      <span className="v2-cart-dropdown-meta">
                        {item.qty} adet · {formatTl(item.price * item.qty, { fractionDigits: 2 })}
                      </span>
                    </span>
                  </Link>
                  <button
                    type="button"
                    className="v2-cart-dropdown-remove"
                    aria-label="Kaldır"
                    onClick={() => removeItem(item.listingId)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="v2-cart-dropdown-foot">
            <div className="v2-cart-dropdown-sum">
              <span>Toplam</span>
              <strong>{totalLabel}</strong>
            </div>
            <Link href="/sepet" className="v2-cart-dropdown-go" onClick={() => setOpen(false)}>
              Sepete Git
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
