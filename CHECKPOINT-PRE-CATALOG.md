# Checkpoint — pre-alisveris-catalog (PHASE 0/1 öncesi)

Tarih: 2026-08-05

Bu commit, alışveriş katalog altyapısı (Brand / Product / Attribute / SellerOffer)
eklenmeden önceki sağlıklı noktadır.

## Local yedekler (`backups/` — git’e alınmaz)

- `teklifbu-db-pre-catalog-2026-08-05T12-15-42.json` — Category, Listing, Shop, User, Settings, Escrow…
- `schema-pre-catalog-2026-08-05T12-15-42.prisma`
- `teklifbu-code-pre-catalog-*.zip` — prisma + src arşivi

## Sağlıklı akışa dönüş

```bash
git switch checkpoint/pre-alisveris-catalog
# veya working tree’yi bu commit’e sıfırlamak için (dikkatli):
# git reset --hard checkpoint/pre-alisveris-catalog
```

DB için: local JSON dump veya hosting snapshot kullanın.
