# Faz 1 — Plan raporu (onay öncesi)

**Durum:** Taslak · Migration **çalıştırılmadı** · Kod yazılmadı  
**Checkpoint:** `checkpoint-pre-alisveris-arch-20260805-195658`  
**Kapsam dışı:** Mirror kaldırma · favori/mesaj refactor · `catalog_checkout_without_mirror` kullanımı

---

## A) Migration taslağı

**Önerilen klasör:** `prisma/migrations/20260805200000_catalog_order_lifecycle_v2/`

```sql
-- Order: ödeme yaşam döngüsü
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentId" TEXT;
-- paymentId: loose String (Payment ile FK opsiyonel — Payment modelinde relation yok; meta ile de bağ var)

CREATE UNIQUE INDEX IF NOT EXISTS "Order_buyerId_idempotencyKey_key"
  ON "Order" ("buyerId", "idempotencyKey")
  WHERE "idempotencyKey" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "Order_status_expiresAt_idx"
  ON "Order" ("status", "expiresAt");

-- OrderItem: stok iadesi idempotency
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "stockReleasedAt" TIMESTAMP(3);
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "stockReservedQty" INTEGER;
-- stockReservedQty: checkout anında düşülen adet (iade için); yoksa quantity kullanılır

-- Payment: completion idempotency + soft expire işareti
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "providerTransactionId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_providerTransactionId_key"
  ON "Payment" ("providerTransactionId")
  WHERE "providerTransactionId" IS NOT NULL;

-- EscrowDeal: katalog order bağını güçlendir (FK zaten Order.escrowDealId ile var)
-- Faz 1'de EscrowDeal'e orderId EKLEMEYİZ (ters FK yeterli; Faz 3'te orderId/sellerOfferId).
-- Meta'ya orderId yazmaya devam / audit.

-- NOT: PaymentStatus enum'a EXPIRED eklemiyoruz (Faz 1).
-- Terk: status = CANCELLED + meta.reason = 'EXPIRED_CHECKOUT' + cancelledAt.
```

**Migration çalıştırma:** yalnızca onay sonrası `prisma migrate deploy`.

---

## B) Prisma alanları

### `Order` (eklenecek)

| Alan | Tip | Anlam |
|---|---|---|
| `paidAt` | `DateTime?` | Escrow fund ile PAID anı |
| `expiresAt` | `DateTime?` | PENDING_PAYMENT sonu (varsayılan now+15dk) |
| `idempotencyKey` | `String?` | Client key; unique with buyerId |
| `paymentId` | `String?` | İlişkili Payment.id (loose) |

Mevcut korunan: `status`, `grandTotal` (kuruş BigInt), `escrowDealId`, `cancelledAt`, tutar alanları.

### `OrderItem` (eklenecek)

| Alan | Tip | Anlam |
|---|---|---|
| `stockReleasedAt` | `DateTime?` | Stok iadesi yapıldıysa set; ikinci iade no-op |
| `stockReservedQty` | `Int?` | Checkout’ta düşülen adet (null → `quantity`) |

### `Payment` (eklenecek)

| Alan | Tip | Anlam |
|---|---|---|
| `providerTransactionId` | `String?` `@unique` where not null | Demo’da = payment.id veya `demo-{intentId}`; gerçek PSP’de provider id |
| `paidAt` | `DateTime?` | PAID anı |
| `cancelledAt` | `DateTime?` | Terk/iptal |

Mevcut: `status` (`PENDING`/`PAID`/`FAILED`/`CANCELLED`/`SIMULATED`), `meta` (escrowDealId, orderId).

### Enum değişiklikleri (Faz 1)

| Enum | Değişiklik |
|---|---|
| `OrderStatus` | Yok (PAID, CANCELLED, PENDING_PAYMENT zaten var) |
| `PaymentStatus` | Yok — EXPIRED yok; CANCELLED + meta |
| `EscrowStatus` | Yok — CANCELLED kullan |

### Settings (migration değil, seed/defaultSettings)

```
catalog_order_payment_lifecycle_v2: boolean (dev default true)
catalog_checkout_idempotency: boolean (dev default true)
catalog_expired_order_reconcile: boolean (dev default true)
catalog_checkout_pending_ttl_minutes: number (default 15)
catalog_checkout_without_mirror: boolean (default false) — FAZ 1 KULLANILMAZ
alisveris_feed_from_offers: boolean (default false) — FAZ 1 KULLANILMAZ
```

---

## C) Dosya ve servis listesi

### Yeni

| Dosya | Rol |
|---|---|
| `src/core/services/catalog/catalogOrderLifecycleService.ts` | `markOrderPaidFromEscrowPayment`, `cancelExpiredCatalogOrder`, `releaseReservedStock` |
| `src/core/services/catalog/catalogOrderReconcileService.ts` | `reconcileExpiredCatalogOrders({ limit })` — scheduler-ready |
| `src/app/api/admin/catalog/reconcile-orders/route.ts` | Admin/manual tetik |
| `scripts/reconcile-expired-catalog-orders.ts` | CLI |
| `scripts/test-catalog-order-lifecycle.ts` | Test A–L |
| `prisma/migrations/20260805200000_catalog_order_lifecycle_v2/migration.sql` | Şema |

### Değişecek

| Dosya | Dokunuş |
|---|---|
| `prisma/schema.prisma` | Order / OrderItem / Payment alanları |
| `src/core/services/catalog/catalogOrderService.ts` | idempotencyKey, expiresAt, stockReservedQty; checkout SoT fiyat = Offer (zaten); flag gate |
| `src/app/api/catalog/checkout/route.ts` | body.idempotencyKey; opportunistic reconcile (flag) |
| `src/core/services/escrowService.ts` | `fundEscrowFromPayment` / `completeEscrowPayment`: aynı tx’te Order→PAID+paidAt; payment completion idempotency |
| `src/app/api/payments/demo-pos/route.ts` | providerTransactionId set; çift tık koruması |
| `src/core/defaultSettings.ts` | flag + TTL |
| `src/lib/catalogCommerce.ts` | isimlendirme notları / helper `*Kurus` alias (breaking rename yok; dokümantasyon + yeni helper isimleri) |
| `docs/alisveris-architecture-migration.md` | Faz 1 checkboxes |

### Dokunulmayan (Faz 1)

- `sellerOfferSyncService` (mirror tx dışı taşıma = Faz 1.5/3)
- Favori / mesaj
- EscrowDeal.listingId zorunluluğu
- Klasik `createEscrowCheckout` mantığı (yalnızca regresyon testi)

---

## D) Transaction sınırları

### Tx-1 — Checkout (`checkoutCatalogOffer`) — flag ON

```
BEGIN
  IF idempotencyKey:
    existing = Order WHERE buyerId+key
    IF existing → RETURN existing (no stock) COMMIT/ROLLBACK empty
  Lock/validate SellerOffer ACTIVE
  Atomic stock UPDATE … WHERE stockQty >= n
  INSERT Order (PENDING_PAYMENT, expiresAt, idempotencyKey, …)
  INSERT OrderItem (stockReservedQty = n)
  INSERT EscrowDeal + Payment (PENDING)  -- mevcut (mirror hâlâ bu tx’te kalabilir Faz1)
  Link escrowDealId / payment meta.orderId
COMMIT
→ payUrl
```

**Faz 1 bilinci:** Mirror sync **hâlâ bu tx içinde olabilir** (kaldırma yok). İleride tx dışına alınacak; Faz 1 çıkış kriterinde “mirror fail olsa sipariş” yok — o Faz 3.

### Tx-2 — Payment completion (`completeEscrowPayment` + fund)

```
BEGIN
  SELECT Payment FOR UPDATE
  IF already PAID → fundEscrow idempotent path; ensure Order PAID; RETURN
  IF CANCELLED/FAILED → abort (timeout kazandı)
  UPDATE Payment → PAID, paidAt, providerTransactionId
  UPDATE EscrowDeal AWAITING_PAYMENT → AWAITING_SHIPMENT (yalnızca bu status)
  UPDATE Order PENDING_PAYMENT → PAID, paidAt
    WHERE status = PENDING_PAYMENT  -- paid order asla iptale gitmez
COMMIT
```

**Kritik:** Order PAID ve Escrow fund **aynı transaction**.

### Tx-3 — Tek order iptal / reconcile item

```
BEGIN
  SELECT Order FOR UPDATE WHERE id AND status = PENDING_PAYMENT AND expiresAt < now
  IF not found → no-op
  SELECT Payment — IF PAID → no-op (race kaybeden)
  UPDATE Order → CANCELLED, cancelledAt
  UPDATE EscrowDeal → CANCELLED (if AWAITING_PAYMENT)
  UPDATE Payment → CANCELLED, cancelledAt (if PENDING)
  FOR each OrderItem WHERE stockReleasedAt IS NULL:
    Atomic stockQty += reserved
    SET stockReleasedAt = now
    IF offer was SOLD_OUT AND stockQty > 0 AND approvedAt → ACTIVE
COMMIT
```

### Tx-4 — Reconcile batch

Her order için **ayrı** Tx-3 (bir order fail → diğerleri devam). Dışarıdan `reconcileExpiredCatalogOrders({ limit: 50 })`.

---

## E) Race-condition politikası

| Yarış | Kazanan | Kayıbeden |
|---|---|---|
| Complete payment vs timeout | **Payment** — Order `PENDING_PAYMENT` FOR UPDATE; timeout yalnız hâlâ PENDING ise iptal | Timeout no-op |
| Timeout vs complete (ters sıra) | Timeout Order’ı CANCELLED yaptıysa complete **abort** (409); para alınmamalı / Demo POS’ta payment zaten PENDING kalmamalı | Complete fail |
| Çift completeEscrowPayment | Payment status PAID + deal alreadyFunded + Order PAID ensure | İkinci çağrı no-op success |
| Çift checkout aynı idempotencyKey | İlk Order döner | İkinci stok düşmez |
| Çift reconcile aynı order | `stockReleasedAt` set → ikinci stok += yok | No-op |
| Stok 1, iki farklı key checkout | İlki alır; ikincisi INSUFFICIENT_STOCK | — |

**Kilitler:** PostgreSQL row lock (`FOR UPDATE` Order/Payment) + conditional `UPDATE … WHERE status = …`.

**Flag OFF:** Eski davranış (Order PAID yazılmaz, reconcile yok, idempotency yok) — kontrollü legacy.

---

## F) Feature flag noktaları

| Flag | Nerede okunur | ON | OFF |
|---|---|---|---|
| `catalog_order_payment_lifecycle_v2` | `fundEscrowFromPayment` / complete path | Order→PAID+paidAt aynı tx | Eski (Order dokunulmaz) |
| `catalog_checkout_idempotency` | `checkoutCatalogOffer` + API | Key unique + replay | Key ignore |
| `catalog_expired_order_reconcile` | checkout opportunistic + admin/script + (ileride cron) | expiresAt set + reconcile | expiresAt null / reconcile no-op |
| `catalog_checkout_pending_ttl_minutes` | checkout | expiresAt = now+N | — |
| `catalog_checkout_without_mirror` | **tanım only** | — | — |
| `alisveris_feed_from_offers` | **tanım only** | — | — |

**Varsayılan öneri:** `defaultSettings` + local/dev `true`; production setting UI’dan kontrollü.

Opportunistic: `POST /api/catalog/checkout` başında (flag ON) `reconcileExpiredCatalogOrders({ limit: 5 })` best-effort (hata checkout’u bozmaz).

---

## G) Test planı

Dosya: `scripts/test-catalog-order-lifecycle.ts` (+ mevcut order-stock ile uyum)

| ID | Senaryo | Beklenen |
|---|---|---|
| A | Ödeme başarılı | Order PAID + paidAt; Escrow AWAITING_SHIPMENT |
| B | Aynı idempotencyKey ×2 | Tek Order, tek stok düşümü |
| C | completeEscrowPayment ×2 | Tek fund; Order tek PAID |
| D | expiresAt geçmiş + reconcile | Order CANCELLED; stok geri |
| E | Reconcile ×2 | stockReleasedAt; stok +1 kez |
| F | Timeout vs pay yarışı | Biri kazanır; PAID order iptal olmaz |
| G | stock=1 → checkout → timeout | stock tekrar 1 |
| H | SOLD_OUT + approvedAt + timeout iade | ACTIVE + stock>0 |
| I | PRICE_CHANGED | Rollback; stok düşmez (mevcut) |
| J | Klasik Listing createEscrowCheckout + fund | Regresyon OK |
| K | Offer 10000 kuruş → Escrow/Payment TL 100; 100× sapma yok | Assert |
| L | Flag OFF | Eski path; A/D zorunlu değil |

Çıkış: **hepsi PASS** + klasik J yeşil.

---

## H) Rollback planı

1. **Flag OFF** (anında): lifecycle/idempotency/reconcile kod yolları legacy’ye düşer.  
2. **Git:** `git checkout checkpoint-pre-alisveris-arch-20260805-195658`  
3. **DB:**  
   `docker cp backups/teklifbu-pre-alisveris-arch-20260805-195658.dump …` + `pg_restore --clean`  
   veya migration reverse: kolonlar nullable/geriye uyumlu — **drop column** yalnız gerekirse (yeni kolonlar zararsız bırakılabilir).  
4. Yarım `CANCELLED` order’lar demo’da kalabilir; production öncesi reconcile raporu.

---

## Para birimi tablosu (Faz 1 sonu hedef rapor — uygulama sonrası doldurulacak)

| Alan | Birim bugün | Faz 1 hedef |
|---|---|---|
| `SellerOffer.price` / `discountedPrice` / `shippingPrice` | Kuruş BigInt | Kuruş (kodda `*Kurus` helper alias) |
| `Order.*Total` / `OrderItem.*Snapshot` | Kuruş BigInt | Kuruş |
| `EscrowDeal.amountTl` | TL Int | TL Int (legacy; katalogda `minorToTl` ile) |
| `Payment.amountTl` | TL Float | TL Float (legacy) |
| `Listing.askPrice` | Klasik TL / mirror kuruş+flag | **Checkout okumaz**; legacy korunur |
| `Bid.amount` | TL BigInt (klasik) | Dokunulmaz |

---

## Onay checklist (sizin için)

Migration + implementasyon başlamadan onay beklenenler:

- [ ] Migration taslağı (A) kabul  
- [ ] Prisma alanları (B) kabul  
- [ ] EscrowDeal’e `orderId` **Faz 1’de yok** (Faz 3) — kabul  
- [ ] Mirror sync hâlâ checkout tx içinde (Faz 1) — kabul  
- [ ] PaymentStatus’e EXPIRED eklenmeyecek — CANCELLED+meta — kabul  

Onay cümlesi örneği: **`Faz 1 migration ve implementasyonu başlat`**
