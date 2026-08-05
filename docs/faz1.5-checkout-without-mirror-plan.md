# Faz 1.5 — Plan raporu (onay öncesi)

**Durum:** Taslak · Migration **çalıştırılmadı** · Kod yazılmadı  
**Önkoşul:** Faz 1 tag `faz1-order-lifecycle-complete` → `66e1c62060b14b626d35062f7484417e46407669`  
**Amaç:** Katalog checkout/ödeme zincirini Listing mirror bağımlılığından çıkarmak (mirror silinmez).

---

## A) Tag sonucu

| Alan | Değer |
|---|---|
| Tag | `faz1-order-lifecycle-complete` (annotated) |
| Target commit | `66e1c62060b14b626d35062f7484417e46407669` |
| Mesaj | Faz 1 complete: order lifecycle, checkout idempotency, payment reconciliation and stock recovery |

---

## B) İki yönlü race test sonucu

`scripts/test-catalog-order-lifecycle.ts` genişletildi (henüz commit edilmedi):

| Test | Sonuç | Özet |
|---|---|---|
| F-A payment first then timeout no-op | **PASS** | Order/Payment PAID, deal AWAITING_SHIPMENT, cancel=`ALREADY_PAID`, `stockReleasedAt=null`, stok geri verilmedi |
| F-B timeout first then payment rejected | **PASS** | Order/Payment CANCELLED, stok bir kez geri, ikinci cancel no-op, payment complete reddedildi |
| F concurrent payment vs timeout race | **PASS** | Tek kazanan; PAID asla iptal edilmez |
| A–L (diğerleri) | **PASS** | 14/14 |

**Kural:** Bu testler yeşil olmadan Faz 1.5 implementasyonuna geçilmez.

---

## C) Mevcut Listing bağımlılıkları (denetim)

### A) `checkoutCatalogOffer` — mirror zorunlu noktalar

Dosya: `src/core/services/catalog/catalogOrderService.ts`

1. **Hard gate** (~209–211): `!offer.listingId \|\| !offer.listing` → `LISTING_MIRROR_MISSING`
2. **OrderItem.listingId** (~300): mirror id yazılır
3. **EscrowDeal.listingId** (~331): zorunlu kolon doldurulur
4. **Payment.meta.listingId** (~363): demo POS / UI için meta

Fiyat zaten SellerOffer üzerinden; Listing.askPrice checkout hesabında kullanılmıyor. Sorun **zorunluluk + FK**, fiyat değil.

### B) EscrowDeal.listingId neden zorunlu?

- `prisma/schema.prisma` `EscrowDeal.listingId String` — **non-null FK**, `onDelete: Cascade`
- Klasik `createEscrowCheckout(session, listingId, …)` listing merkezli
- Katalog yolu aynı şemayı doldurmak zorunda

### C) Payment / Escrow / Order gerçek FK’ler

| İlişki | Gerçeklik |
|---|---|
| Order → EscrowDeal | **FK** `Order.escrowDealId` `@unique` |
| EscrowDeal → Order | reverse `EscrowDeal.order` (aynı FK) |
| Order.paymentId | **loose string** (FK yok) |
| EscrowDeal.paymentId | **loose string** |
| Payment → Order/Deal | **yok**; `meta.orderId` / `meta.escrowDealId` |
| EscrowDeal → Listing | **zorunlu FK** |

### D) Mirror sync checkout tx içinde nerede?

`catalogOrderService.ts` ~382: `await syncListingMirrorFromOffer(tx, offer.id)` — stok + Order + Deal + Payment **sonrası**, aynı `$transaction` içinde.

### E) Mirror sync hata verirse rollback

Tx ile birlikte rollback:

- SellerOffer stok düşümü
- Order + OrderItem
- EscrowDeal + Payment + link update’leri
- sync’in Listing update’i

`writeAuditLog` global `prisma` kullanır (tx dışı) ve hata yutar — ticari kayıtlar yine de rollback olur.

### F) Checkout sonrası listingId bekleyen yüzeyler

| Yüzey | Bağımlılık |
|---|---|
| `/odeme/demo-pos` | `meta.listingId` → başlık / geri link |
| `AccountInner` Güvenli Öde | `/ilan/${listing.id}` |
| `AccountShoppingPanel` | tekrar al / satıcıya sor → listing |
| `/urun/[id]` | CTA yalnız `best.listingId` varsa `/ilan/...` |
| `/api/catalog/checkout` response | `payUrl` (payment id) — listing zorunlu değil |

### G) Demo POS → Order

1. Payment `purpose=escrow_hold`, meta: `orderId`, `escrowDealId`, …
2. POST pay → `completeEscrowPayment(session, paymentId)`
3. Order: `payment.meta.orderId` + (lifecycle v2) `markOrderPaidInTx`

Listing üzerinden Order bulunmuyor.

### H) Release / refund / dispute

İş kuralı **dealId** ile; listingId okunmaz. Şema dolaylı: Listing silinirse EscrowDeal cascade.

### I) Admin ekranları

Filtre/görüntüleme `listing` include; aksiyonlar `dealId`. listingId null olursa UI "—" gösterebilir, aksiyon çalışmalı.

### J) Notification / message / audit

- Notification: listing zorunlu değil (`link` string)
- Message: `listingId` optional
- Audit: entity Order/Deal; listing zorunlu değil

---

## D) Migration taslağı (uygulanmayacak — onay sonrası)

Önerilen klasör: `prisma/migrations/YYYYMMDDHHMMSS_catalog_checkout_without_mirror/`

```sql
-- EscrowDeal: katalog için Order merkezli; klasik için listing merkezli
ALTER TABLE "EscrowDeal" ALTER COLUMN "listingId" DROP NOT NULL;

ALTER TABLE "EscrowDeal" ADD COLUMN IF NOT EXISTS "orderId" TEXT;
ALTER TABLE "EscrowDeal" ADD COLUMN IF NOT EXISTS "sellerOfferId" TEXT;

-- orderId unique optional (1 deal ↔ 1 order; Order.escrowDealId zaten unique)
CREATE UNIQUE INDEX IF NOT EXISTS "EscrowDeal_orderId_key"
  ON "EscrowDeal" ("orderId") WHERE "orderId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "EscrowDeal_sellerOfferId_idx"
  ON "EscrowDeal" ("sellerOfferId");

-- FK'ler (onDelete dikkat):
-- listingId: Cascade → SetNull (katalog deal Listing silinse yaşasın) önerilir
-- orderId → Order(id) ON DELETE SET NULL
-- sellerOfferId → SellerOffer(id) ON DELETE SET NULL

-- XOR check constraint: GEÇİŞ SONRASI (aşağıda F)
-- ALTER TABLE "EscrowDeal" ADD CONSTRAINT "EscrowDeal_classic_or_catalog_xor"
--   CHECK (
--     ("listingId" IS NOT NULL AND "orderId" IS NULL) OR
--     ("orderId" IS NOT NULL AND "listingId" IS NULL) OR
--     ("listingId" IS NOT NULL AND "orderId" IS NOT NULL) -- geçiş satırları; final XOR'da kaldırılır
--   );
```

**Faz 1.5’te uygulanmaz:** mirror silme, Listing kolon drop, feed/favori/mesaj.

---

## E) Prisma ilişki planı

```prisma
model EscrowDeal {
  listingId     String?   // klasik zorunlu (app); katalog flag ON → null olabilir
  orderId       String?   @unique
  sellerOfferId String?   // denormalize kolaylık; SoT = OrderItem.sellerOfferId

  listing     Listing?     @relation(...)
  orderById   Order?       @relation("EscrowDealOrder", fields: [orderId], references: [id], onDelete: SetNull)
  // Mevcut Order.escrowDealId ilişkisi korunur (çift yön dikkatli tasarlanmalı)
  sellerOffer SellerOffer? @relation(...)
}
```

**Kalıcı iş kuralı (uygulama katmanı + ileride DB):**

| Tip | listingId | orderId |
|---|---|---|
| Klasik escrow | dolu | boş |
| Katalog escrow (hedef) | boş | dolu |
| Geçiş (flag ON, uyumluluk) | dolu + orderId dolu | geçici kabul |

**Source of truth (katalog):** Order (+ OrderItem → SellerOffer).  
`EscrowDeal.sellerOfferId` opsiyonel denormalize.

**Order.escrowDealId** bugün zaten var; Faz 1.5’te `EscrowDeal.orderId` eklenince **çift yön** oluşur. Tercih:

1. Kısa vadede her iki tarafı da yaz (uyumluluk)
2. Okuma: `Order.escrowDealId` veya `EscrowDeal.orderId` — payment completion her ikisini de dene
3. Faz 3+ tek yön sadeleştirme (kapsam dışı)

---

## F) DB constraint stratejisi

**XOR check constraint hemen uygulanmamalı.**

| Seçenek | Risk |
|---|---|
| Hemen XOR (listing XOR order) | Mevcut katalog deal’lerde listingId dolu + orderId null → yeni insert’ler orderId doldurunca eski satırlar XOR’u bozar; backfill bitmeden deploy kırılır |
| Geçişte “en az biri dolu” | Güvenli; klasik+katalog karışık satırlara izin |
| Final XOR (geçiş sonrası) | Backfill + flag default ON + eski listingId null’ama sonrası |

**Öneri:** Faz 1.5 migration’da yalnız **nullable listingId + orderId/sellerOfferId kolonları**. XOR = Faz 1.5 çıkışından sonra ayrı migration (veya Faz 3).

---

## G) Değişecek dosyalar (plan — kod yok)

| Dosya | Değişiklik |
|---|---|
| `prisma/schema.prisma` | EscrowDeal nullable listingId, orderId, sellerOfferId |
| migration.sql | yukarıdaki taslak |
| `catalogOrderService.ts` | flag ON: mirror gate kaldır; deal.orderId; sync post-commit |
| `catalogOrderLifecycleService.ts` | gerekirse deal.orderId okuma |
| `escrowService.ts` | completeEscrowPayment: orderId ile deal bul; listing opsiyonel |
| `sellerOfferSyncService.ts` | post-commit / no-op if no listing |
| `defaultSettings.ts` | flag default **false** (prod); description güncelle |
| `demo-pos/route.ts` + `page.tsx` | listing yoksa Order/Offer başlığı |
| `AccountShoppingPanel` / `AccountInner` | `/urun` veya sipariş detay fallback |
| `/urun/[id]/page.tsx` | mirror’suz checkout CTA |
| Admin escrow/order panelleri | listing null UI |
| Testler | A–L Faz 1.5 + F-A/F-B regresyon |

**Dokunulmayacak (kapsam dışı):** alışveriş feed/facet, favori, mesaj modeli, mirror silme, klasik Listing politikası, barkod unique, PSP.

---

## H) Transaction sınırları

### Flag OFF (mevcut)

Tek tx: stok → Order/Item → EscrowDeal(listingId) → Payment → **syncListingMirror** → commit

### Flag ON (hedef)

**Tx1 (ticari — atomik):**

1. Offer/Product/Variant aktiflik
2. Fiyat (SellerOffer only)
3. Atomik stok düşümü
4. Order + OrderItem (`listingId` null olabilir)
5. EscrowDeal (`orderId` dolu; `listingId` null veya geçişte dolu)
6. Payment + loose linkler

**Tx1 dışında (best-effort):**

7. Mirror sync (listing varsa)
8. Audit (sync fail)

`LISTING_MIRROR_MISSING` flag ON iken **atılmaz**.

---

## I) Post-commit mirror sync yaklaşımı

| Seçenek | Artı | Eksi |
|---|---|---|
| Doğrudan post-commit await | En sade | Request latency; process crash → sync kaçabilir |
| Outbox event tablosu | Güçlü | Yeni infra |
| Background job / cron | Dayanıklı | Gecikme |
| Retry tablosu | Orta | Ek model |

**Öneri (ilk uygulanabilir güvenli):**

1. **Checkout commit sonrası** `try { await syncListingMirrorFromOffer(prisma, offerId) } catch { writeAuditLog(...); }`
2. Sync no-op if `!listingId` (zaten var)
3. İsteğe bağlı: mevcut `reconcile` cron’una “stale mirror” taraması (Faz 1.5+), **zorunlu değil**

Outbox’a erken gitme — Faz 1.5 için overkill. Audit + retryable sync fonksiyonu yeterli.

---

## J) Backfill planı

**Gerekli mi?** Kısmen — soft backfill önerilir, zorla rewrite yok.

Mevcut katalog satırları:

- `EscrowDeal.listingId` dolu
- `Order.escrowDealId` dolu → Order var
- `EscrowDeal.orderId` boş olacak

**Güvenli eşleştirme:**

```sql
UPDATE "EscrowDeal" e
SET "orderId" = o.id
FROM "Order" o
WHERE o."escrowDealId" = e.id
  AND e."orderId" IS NULL;
```

**sellerOfferId:**

```sql
UPDATE "EscrowDeal" e
SET "sellerOfferId" = oi."sellerOfferId"
FROM "OrderItem" oi
WHERE oi."orderId" = e."orderId"
  AND e."sellerOfferId" IS NULL;
-- Ambiguous (çok satırlı order): atla / audit
```

**Kurallar:**

- Belirsiz (1 deal ↔ 0 veya >1 order) → **otomatik değiştirme**; audit listesi
- Eski satırlarda listingId **silinmez** (geriye dönük UI)
- Yeni katalog (flag ON): orderId dolu, listingId null (veya geçiş politikası)

---

## K) Feature flag davranışı

`catalog_checkout_without_mirror` (zaten `defaultSettings.ts`’te tanımlı, **kullanılmıyor**)

| Ortam | Default |
|---|---|
| Production | **OFF** |
| Dev/test | kontrollü ON ile test |

| Flag | Davranış |
|---|---|
| **OFF** | Mevcut: mirror zorunlu, sync tx içi, listingId deal’de dolu |
| **ON** | Mirror zorunlu değil; EscrowDeal.orderId; sync post-commit; `LISTING_MIRROR_MISSING` yok |

Rollback: flag OFF → eski yol (mirror’süz offer’lar checkout edemez — beklenen).

---

## L) A–L test planı (Faz 1.5)

| # | Senaryo | Beklenen |
|---|---|---|
| A | Mirror’süz SellerOffer checkout | Order+Item+Escrow+Payment |
| B | Mirror sync hata | Checkout OK; stok/ödeme rollback yok; audit |
| C | Listing.askPrice yanlış | SellerOffer fiyatı |
| D | SOLD_OUT | Red |
| E | Katalog EscrowDeal | orderId dolu; listingId boş veya geçiş politikası |
| F | Payment completion | listingId olmadan Order PAID |
| G | Refund/release | Order bağlı deal çalışır |
| H | Klasik Listing escrow | listingId ile eski davranış |
| I | Flag OFF | Mevcut davranış |
| J | Eski katalog escrow | Görüntüleme/işlem bozulmaz |
| K | Payment–timeout iki yönlü (F-A/F-B) | Faz 1 yeşil |
| L | `/urun` mirror’süz | Görünür + katalog checkout CTA |

---

## M) Rollback planı

1. Flag OFF (anında davranış geri)
2. Git: `faz1-order-lifecycle-complete` / `66e1c62` sağlıklı baz
3. Migration reverse: orderId/sellerOfferId drop + listingId NOT NULL (yalnız orderId null satırlar yokken)
4. DB dump: `backups/teklifbu-post-faz1-lifecycle-*.dump`

---

## N) Riskler ve çözüm sırası

| # | Risk | Çözüm sırası |
|---|---|---|
| 1 | EscrowDeal.listingId NOT NULL kırılması | Önce schema nullable + app flag |
| 2 | Listing cascade deal siler | onDelete SetNull (katalog) |
| 3 | Çift Order↔Deal FK karışıklığı | Her iki tarafı yaz; okuma fallback zinciri |
| 4 | UI `/ilan` kırılır | Fallback `/urun` / sipariş detay |
| 5 | Sync tx dışı kaçırma | Audit + idempotent sync; opsiyonel reconcile |
| 6 | XOR erken | Geçiş sonrası ayrı migration |
| 7 | Klasik regresyon | H + mevcut escrow testleri zorunlu |
| 8 | Faz 1 lifecycle bozulması | F-A/F-B + A–L lifecycle her PR |

**Uygulama sırası (onay sonrası):**

1. Migration (nullable + orderId/sellerOfferId) — XOR yok  
2. Soft backfill orderId  
3. Flag wiring + checkout path  
4. completeEscrowPayment order-centric  
5. Post-commit sync  
6. UI fallbacks (`/urun` CTA, demo-pos, hesap)  
7. Testler A–L + F-A/F-B  
8. Dev flag ON smoke; prod default OFF  

---

## Çıkış kriteri (Faz 1.5)

- [ ] Katalog checkout mirror olmadan
- [ ] Escrow katalogda Order’a bağlı (`orderId`)
- [ ] Listing.askPrice katalog ödemede kullanılmıyor (zaten; korunacak)
- [ ] Mirror sync transaction dışı
- [ ] Sync hatası ticari işlemi bozmuyor
- [ ] Klasik escrow regresyon temiz
- [ ] Faz 1 lifecycle/idempotency/F-A/F-B yeşil
- [ ] Flag ile geri dönüş mümkün

---

## Onay bekleniyor

Bu doküman onaylanmadan:

- Migration **çalıştırılmayacak**
- Faz 1.5 uygulama kodu **yazılmayacak**

Race test dosyası (`scripts/test-catalog-order-lifecycle.ts`) working tree’de; istenirse ayrı commit ile Faz 1 tag’inden sonra kaydedilebilir.
