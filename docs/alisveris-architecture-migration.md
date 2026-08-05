# Alışveriş mimarisi göç planı

**Checkpoint:** `checkpoint-pre-alisveris-arch-20260805-195658`  
**DB yedek:** `backups/teklifbu-pre-alisveris-arch-20260805-195658.dump` (+ `.sql`)  
**Amaç:** Katalog alışverişte tek doğru kaynak (SellerOffer + Order); Listing mirror’ı kontrollü emekli etmek.  
**Kural:** Parça parça · her fazda eski akış açık · feature flag · smoke test · geri alınabilir.

---

## Hedef mimari (alışveriş)

| Akış | Source of truth |
|---|---|
| Katalog satış | `Product` → `ProductVariant` → `SellerOffer` → `Order` / `OrderItem` |
| Güvenli ödeme (katalog) | `EscrowDeal` ↔ `Order` (Listing zorunlu olmasın) |
| Vitrin / arama (alışveriş) | SellerOffer / Product feed (geçişte flag) |
| Emlak / vasıta / premium / klasik Listing | **Dokunulmaz** — mevcut Listing + Bid |

Mirror: geçiş köprüsü → yazmayı kes → sonra temizle.

---

## Faz 0 — Checkpoint (DONE)

- [x] Git commit + tag
- [x] PostgreSQL dump (`backups/`)
- [x] Bu plan dosyası

Geri dönüş:
```bash
git checkout checkpoint-pre-alisveris-arch-20260805-195658
# DB:
docker exec -i teklifbu-postgres pg_restore -U teklifbu -d teklifbu --clean --if-exists < backups/....dump
# veya psql < backups/....sql
```

---

## Faz 1 — Temel sağlamlaştırma (mirror KALIR)

**Detay plan:** [`docs/faz1-order-lifecycle-plan.md`](./faz1-order-lifecycle-plan.md) (onay öncesi — migration henüz yok)

1. Order → PAID (escrow fund ile aynı tx)
2. Terk checkout reconcile + stok iadesi (idempotent)
3. Checkout + payment completion idempotency
4. Fiyat birimi netliği (checkout Listing.askPrice okumaz)
5. Feature flags (lifecycle / idempotency / reconcile)

**Çıkış kriteri:** Plan dosyasındaki A–L testler PASS; klasik escrow regresyon OK; mirror davranışı aynı.

---

## Faz 2 — Okuma yolu (paralel)

1. Feature flag: `alisveris_feed_from_offers`
2. `/alisveris` (veya bir bölüm) SellerOffer feed okuyabilir
3. Listing feed fallback açık kalır
4. PDP zaten `/urun` — güçlendir

**Çıkış kriteri:** Flag on/off ile vitrin doğru; emlak/vasıta etkilenmez.

---

## Faz 3 — Escrow’u Order’a bağla (demo laboratuvar)

1. `EscrowDeal` üzerinde `orderId` (veya Order zaten `escrowDealId` — çift yön net)
2. Katalog checkout: mirror **olmadan** escrow oluşturabilsin (flag)
3. Klasik Listing escrow yolu regresyon test
4. `listingId` katalogda opsiyonel hale gelme (migration)

**Çıkış kriteri:** Flag ile mirror’suz katalog checkout + escrow fund; klasik escrow bozulmaz.

---

## Faz 4 — Mirror yazmayı kes

1. Flag: `catalog_create_listing_mirror` default false
2. Sync servisi sadece eski mirror’lar için (veya no-op)
3. Yeni Offer’lar Listing üretmez

**Çıkış kriteri:** Yeni katalog satışları mirror’suz; eski mirror’lı kayıtlar çalışır.

---

## Faz 5 — Temizlik

1. Eski mirror Listing’leri arşiv / unlink planı
2. `syncListingMirrorFromOffer` emekli
3. Admin/UI “teklif” isim ayrımı (Bid vs SellerOffer)
4. Dokümantasyon güncelle

---

## Bilinçli dokunulmayanlar

- Klasik Bid motoru
- Emlak / vasıta Listing
- Dikey ACL matrisi (koru, genişlet)
- Demo POS soyutlaması (PSP gelince sadece adapter)

---

## Birlikte çalışma sırası

Şu an durduğumuz yer: **Faz 0 tamam → Faz 1’e geçiş onayı bekleniyor.**

Onay cümlesi örneği: `Faz 1'i başlat`
