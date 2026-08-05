"use client";

import { useMemo, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { formatTl, parseMoneyTr } from "@/lib/format";
import {
  SHOPPING_CARD_OPTIONS,
  SHOPPING_CONDITION_OPTIONS,
  SHOPPING_PRODUCT_ATTR_LABELS,
  calcInstallmentAmounts,
  createEmptyInstallment,
  parseInstallments,
  serializeInstallments,
  type ShoppingInstallmentPlan,
} from "@/data/shoppingProductAttrs";

type Attrs = Record<string, string>;

function Field({
  label,
  hint,
  children,
  full,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  full?: boolean;
}) {
  return (
    <label className={full ? "shop-form-full" : undefined} style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{label}</span>
      {children}
      {hint ? <span className="shop-form-hint">{hint}</span> : null}
    </label>
  );
}

type Props = {
  attrs: Attrs;
  setAttr: (key: string, value: string) => void;
  askPrice?: string;
  askPriceHint?: string;
};

/**
 * Online mağaza ürün ilanı formu (Trendyol / Hepsiburada tarzı alanlar).
 * Fiyatın asıl kaynağı form.askPrice (ilan fiyatı / satış fiyatı); burada liste & premium fiyat.
 */
export function ShoppingProductFormFields({ attrs, setAttr, askPrice, askPriceHint }: Props) {
  const L = SHOPPING_PRODUCT_ATTR_LABELS;
  const price = parseMoneyTr(String(askPrice || "")) || 0;

  const plans = useMemo(() => {
    const parsed = parseInstallments(attrs.installments);
    return parsed;
  }, [attrs.installments]);

  function setPlans(next: ShoppingInstallmentPlan[]) {
    setAttr("installments", serializeInstallments(next));
  }

  function updatePlan(id: string, patch: Partial<ShoppingInstallmentPlan>) {
    setPlans(plans.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function removePlan(id: string) {
    setPlans(plans.filter((p) => p.id !== id));
  }

  function addPlan() {
    setPlans([...plans, createEmptyInstallment()]);
  }

  function seedDefaults() {
    setPlans([
      { id: "1", card: "Tüm kartlar", months: 1, ratePercent: 0 },
      { id: "2", card: "World", months: 3, ratePercent: 0 },
      { id: "3", card: "Bonus", months: 6, ratePercent: 4.5 },
      { id: "4", card: "Axess", months: 9, ratePercent: 6.9 },
    ]);
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.45 }}>
        E-ticaret ürün formu: marka, stok, fiyat katmanları, kargo, taksit tablosu ve özellikler. Satış fiyatı
        aşağıdaki «Fiyat ve süre» bölümündeki ilan fiyatıdır.
        {askPriceHint ? ` ${askPriceHint}` : ""}
      </p>

      <div className="shop-form-grid">
        <Field label={L.brand}>
          <input
            className="input"
            value={attrs.brand || ""}
            onChange={(e) => setAttr("brand", e.target.value)}
            placeholder="Örn: BRITA, Apple"
          />
        </Field>
        <Field label={L.model}>
          <input
            className="input"
            value={attrs.model || ""}
            onChange={(e) => setAttr("model", e.target.value)}
            placeholder="Örn: Marella XL"
          />
        </Field>
        <Field label={L.condition}>
          <select className="select" value={attrs.condition || ""} onChange={(e) => setAttr("condition", e.target.value)}>
            <option value="">Seçin</option>
            {SHOPPING_CONDITION_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label={L.warranty}>
          <select className="select" value={attrs.warranty || ""} onChange={(e) => setAttr("warranty", e.target.value)}>
            <option value="">Seçin</option>
            <option value="Var">Var</option>
            <option value="Yok">Yok</option>
            <option value="2 Yıl">2 Yıl</option>
            <option value="3 Yıl">3 Yıl</option>
          </select>
        </Field>
        <Field label={L.color}>
          <input
            className="input"
            value={attrs.color || ""}
            onChange={(e) => setAttr("color", e.target.value)}
            placeholder="Örn: Beyaz"
          />
        </Field>
        <Field label={L.originCountry}>
          <input
            className="input"
            value={attrs.originCountry || ""}
            onChange={(e) => setAttr("originCountry", e.target.value)}
            placeholder="Örn: Almanya"
          />
        </Field>
        <Field label={L.sku} hint="Mağaza içi stok kodu">
          <input
            className="input"
            value={attrs.sku || ""}
            onChange={(e) => setAttr("sku", e.target.value)}
            placeholder="Örn: BR-MXL-35-W"
          />
        </Field>
        <Field label={L.barcode}>
          <input
            className="input"
            value={attrs.barcode || ""}
            onChange={(e) => setAttr("barcode", e.target.value)}
            placeholder="Barkod / EAN"
          />
        </Field>
        <Field label={L.gtin}>
          <input
            className="input"
            value={attrs.gtin || ""}
            onChange={(e) => setAttr("gtin", e.target.value)}
            placeholder="Opsiyonel GTIN"
          />
        </Field>
        <Field label={L.stockQty} hint="Stok azaldıkça detay sayfasında uyarı gösterilir">
          <input
            className="input"
            inputMode="numeric"
            value={attrs.stockQty || ""}
            onChange={(e) => setAttr("stockQty", e.target.value.replace(/[^\d]/g, ""))}
            placeholder="Örn: 12"
          />
        </Field>
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 850, marginBottom: 8 }}>Fiyat katmanları</div>
        <div className="shop-form-grid">
          <Field
            label={L.listPrice}
            hint="Üstü çizili eski / liste fiyatı (kuruşlu). Satış fiyatı «Fiyat ve süre» alanındadır."
          >
            <input
              className="input"
              inputMode="decimal"
              value={attrs.listPrice || ""}
              onChange={(e) => setAttr("listPrice", e.target.value.replace(/[^\d.,]/g, ""))}
              onBlur={() => {
                const n = parseMoneyTr(attrs.listPrice || "");
                if (n > 0) setAttr("listPrice", String(Math.round(n * 100) / 100));
              }}
              placeholder="Örn: 1.099,00"
            />
          </Field>
          <Field label={L.premiumPrice} hint="Premium üyeye sepette gösterilecek fiyat (kuruşlu)">
            <input
              className="input"
              inputMode="decimal"
              value={attrs.premiumPrice || ""}
              onChange={(e) => setAttr("premiumPrice", e.target.value.replace(/[^\d.,]/g, ""))}
              onBlur={() => {
                const n = parseMoneyTr(attrs.premiumPrice || "");
                if (n > 0) setAttr("premiumPrice", String(Math.round(n * 100) / 100));
              }}
              placeholder="Örn: 782,50"
            />
          </Field>
        </div>
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 850 }}>Taksit seçenekleri</div>
            <div className="shop-form-hint" style={{ marginTop: 2 }}>
              Kart, taksit sayısı ve vade farkı (%). Aylık / toplam satış fiyatına göre otomatik hesaplanır
              {price > 0 ? ` (şu an ${formatTl(price, { fractionDigits: 2 })})` : " — önce ilan fiyatını girin"}.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {plans.length === 0 ? (
              <button type="button" className="btn-outline" style={{ padding: "7px 10px", fontSize: 12 }} onClick={seedDefaults}>
                Örnek doldur
              </button>
            ) : null}
            <button type="button" className="btn-outline" style={{ padding: "7px 10px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }} onClick={addPlan}>
              <Plus size={14} /> Satır ekle
            </button>
          </div>
        </div>

        <div className="shop-form-install-wrap">
          <table className="shop-form-install-table">
            <thead>
              <tr>
                <th>Kart</th>
                <th>Taksit</th>
                <th>Vade farkı %</th>
                <th>Aylık</th>
                <th>Toplam</th>
                <th aria-label="Sil" />
              </tr>
            </thead>
            <tbody>
              {plans.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "#94a3b8", padding: 16, fontSize: 13 }}>
                    Henüz taksit satırı yok. «Satır ekle» veya «Örnek doldur» ile başlayın.
                  </td>
                </tr>
              ) : (
                plans.map((p) => {
                  const calc = calcInstallmentAmounts(price, p.months, p.ratePercent);
                  return (
                    <tr key={p.id}>
                      <td>
                        <select
                          className="select"
                          value={
                            (SHOPPING_CARD_OPTIONS as readonly string[]).includes(p.card) ? p.card : "__custom__"
                          }
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === "__custom__") updatePlan(p.id, { card: "Diğer" });
                            else updatePlan(p.id, { card: v });
                          }}
                        >
                          {SHOPPING_CARD_OPTIONS.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                          {!(SHOPPING_CARD_OPTIONS as readonly string[]).includes(p.card) ? (
                            <option value="__custom__">{p.card}</option>
                          ) : null}
                        </select>
                        {p.card === "Diğer" || !(SHOPPING_CARD_OPTIONS as readonly string[]).includes(p.card) ? (
                          <input
                            className="input"
                            style={{ marginTop: 6 }}
                            value={p.card === "Diğer" ? "" : p.card}
                            placeholder="Kart adı yazın"
                            onChange={(e) => updatePlan(p.id, { card: e.target.value.trim() || "Diğer" })}
                          />
                        ) : null}
                      </td>
                      <td>
                        <input
                          className="input"
                          inputMode="numeric"
                          value={p.months || ""}
                          onChange={(e) =>
                            updatePlan(p.id, { months: Math.max(1, Number(e.target.value.replace(/[^\d]/g, "")) || 1) })
                          }
                          style={{ width: 72 }}
                        />
                      </td>
                      <td>
                        <input
                          className="input"
                          inputMode="decimal"
                          value={String(p.ratePercent)}
                          onChange={(e) => {
                            const raw = e.target.value.replace(",", ".");
                            const n = Number(raw);
                            updatePlan(p.id, { ratePercent: Number.isFinite(n) ? Math.max(0, n) : 0 });
                          }}
                          style={{ width: 88 }}
                        />
                      </td>
                      <td className="shop-form-install-calc">
                        {price > 0 ? formatTl(calc.monthly, { fractionDigits: 2 }) : "—"}
                        {calc.months > 1 && price > 0 ? (
                          <span className="shop-form-install-sub">× {calc.months}</span>
                        ) : null}
                      </td>
                      <td className="shop-form-install-calc">{price > 0 ? formatTl(calc.total, { fractionDigits: 2 }) : "—"}</td>
                      <td>
                        <button
                          type="button"
                          className="shop-form-install-del"
                          onClick={() => removePlan(p.id)}
                          aria-label="Satırı sil"
                          title="Sil"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 850, marginBottom: 8 }}>Kargo & teslimat</div>
        <div className="shop-form-grid">
          <label className="shop-form-check">
            <input
              type="checkbox"
              checked={(attrs.shippingFree || "").toLowerCase() === "evet"}
              onChange={(e) => setAttr("shippingFree", e.target.checked ? "Evet" : "Hayır")}
            />
            Ücretsiz kargo
          </label>
          <label className="shop-form-check">
            <input
              type="checkbox"
              checked={(attrs.sameDayShipping || "").toLowerCase() === "evet"}
              onChange={(e) => setAttr("sameDayShipping", e.target.checked ? "Evet" : "Hayır")}
            />
            Aynı gün kargo
          </label>
          <Field label={L.shippingLabel} hint="Örn: Yarın Kapında, 2 iş günü">
            <input
              className="input"
              value={attrs.shippingLabel || ""}
              onChange={(e) => setAttr("shippingLabel", e.target.value)}
              placeholder="Yarın Kapında"
            />
          </Field>
          <Field label={L.returnDays}>
            <input
              className="input"
              inputMode="numeric"
              value={attrs.returnDays || ""}
              onChange={(e) => setAttr("returnDays", e.target.value.replace(/[^\d]/g, ""))}
              placeholder="14"
            />
          </Field>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 850, marginBottom: 8 }}>Vitrin & medya</div>
        <div className="shop-form-grid">
          <Field label={L.badgeText} hint="Örn: EN ÇOK SATAN">
            <input
              className="input"
              value={attrs.badgeText || ""}
              onChange={(e) => setAttr("badgeText", e.target.value)}
              placeholder="EN ÇOK SATAN"
            />
          </Field>
          <Field label={L.promoBadge} hint="Örn: Premium'a Özel 100 TL İndirim">
            <input
              className="input"
              value={attrs.promoBadge || ""}
              onChange={(e) => setAttr("promoBadge", e.target.value)}
              placeholder="Kampanya rozeti"
            />
          </Field>
          <Field label={L.videoUrl} full>
            <input
              className="input"
              value={attrs.videoUrl || ""}
              onChange={(e) => setAttr("videoUrl", e.target.value)}
              placeholder="https://..."
            />
          </Field>
          <Field label={L.viewAngle360} full>
            <input
              className="input"
              value={attrs.viewAngle360 || ""}
              onChange={(e) => setAttr("viewAngle360", e.target.value)}
              placeholder="https://... (360 görsel)"
            />
          </Field>
          <Field
            label={L.highlights}
            hint="Her satıra bir özellik. Detay sayfasında madde listesi olarak görünür."
            full
          >
            <textarea
              className="input"
              rows={5}
              value={attrs.highlights || ""}
              onChange={(e) => setAttr("highlights", e.target.value)}
              placeholder={"Maxtra Pro All-in-1 filtre teknolojisi\n3.5 L sürahi kapasitesi\nBPA içermez"}
              style={{ resize: "vertical", minHeight: 100 }}
            />
          </Field>
        </div>
      </div>
    </div>
  );
}
