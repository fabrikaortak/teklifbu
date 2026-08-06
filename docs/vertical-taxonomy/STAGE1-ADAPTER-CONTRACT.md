# Vasıta AŞAMA 1 — Adapter sözleşmesi (UI / akış bozulmaz)

**Durum:** Mimari onaylı · DB seed henüz yok · UI değiştirilmez

## Garantiler

| Katman | Kural |
|--------|--------|
| İlan oluşturma layout / input / select görünümü | Değişmez |
| Detay / kart / liste / tema / CSS | Değişmez |
| `Listing.dealType` | Aynı kolon |
| `Listing.attributes` anahtarları | Yeni ilanlarda legacy-uyumlu yazılır |
| Eski ilanlar | Okunur; rewrite yok |

## Veri akışı (hedef)

```
DB Category (+ browseRole meta)
  → /api/... browse adapter → BrowseNode[] (mevcut ladder şekli)
  → CategoryLadderPicker (aynı component)
  → form field config adapter (vehicleFormFields şekli)
  → submit → attributes JSON (subtype, brand, model, trim, year, km, …)
```

## Browse vs katalog

- **VEHICLE_TYPE** Category → `categoryId` / subtype kaynağı
- **MARKET_SEGMENT / TRANSACTION_MODE / CONDITION_SEGMENT / SPECIAL_SEGMENT** → filtre hub; Brand/Model buraya bağlanmaz
- Kullanıcı hub’dan girse bile kayıt kanonik tipe + bayraklara yazılır  
  Örn. Elektrikli Otomobil → `otomobil` + `fuelType=ELECTRIC`  
  Kiralık → kanonik tip + `dealType=KIRALIK`

## Seçim zinciri (AŞAMA 1)

Marka → Model → (Nesil/Versiyon SoT veya trim) → Model yılı  
Motor / şanzıman / kasa: önerilir, kullanıcı değiştirebilir  
Başlık: serbest

## Yasak (AŞAMA 1)

- VehicleGeneration / Trim / Powertrain / SpecSheet tabloları
- Listing’e vehicle FK kolonları
- UI redesign, CSS/theme değişikliği
- Uydurma marka/model seed (`verified=false` production’a girmez)

## Sonraki uygulama sırası

1. SoT mapping + attribute CSV (bu klasör)
2. Checkpoint tag + DB dump (seed öncesi)
3. Category / Attribute seed (idempotent)
4. API browse adapter (TS fallback kalır)
5. Form adapter bağlama (görünüm aynı)
6. Test suite · UI snapshot “yalnız seçenek sayısı farkı”

Kaynak ağaç: `docs/vertical-taxonomy/vehicle-stage1-target-tree.json`
