# Telefon migration risk report

Generated: 2026-08-06T00:44:22.799Z
Status: PLAN ONLY — no DB writes

## Current DB phone-related nodes (Sıfır)
| name | slug | listings | products | offers | brands | attrs | models |
|---|---|---:|---:|---:|---:|---:|---:|
| Tuşlu Telefon | `sifir-urun-cep-telefonu__tuslu-telefon` | 9 | 10 | 15 | 30 | 7 | 0 |
| Akıllı Saat & Bileklik | `sifir-urun-cep-telefonu__akilli-saat` | 0 | 0 | 0 | 30 | 7 | 0 |
| Kulaklık & Bluetooth | `sifir-urun-cep-telefonu__kulaklik` | 0 | 0 | 0 | 30 | 7 | 0 |
| Şarj & Powerbank | `sifir-urun-cep-telefonu__sarj-powerbank` | 0 | 0 | 0 | 30 | 7 | 0 |
| Kılıf & Koruyucu | `sifir-urun-cep-telefonu__kilif-aksesuar` | 0 | 0 | 0 | 30 | 7 | 0 |
| Diğer Aksesuar | `sifir-urun-cep-telefonu__diger-aksesuar` | 0 | 0 | 0 | 30 | 7 | 0 |
| Yenilenmiş Telefon | `sifir-urun-cep-telefonu__yenilenmis-telefon` | 0 | 0 | 0 | 30 | 7 | 0 |
| Akıllı Bileklik | `sifir-urun-cep-telefonu__akilli-bileklik` | 0 | 0 | 0 | 30 | 7 | 0 |
| Telefon Kılıfı | `sifir-urun-cep-telefonu__telefon-kilifi` | 0 | 0 | 0 | 30 | 7 | 0 |
| Ekran Koruyucu | `sifir-urun-cep-telefonu__ekran-koruyucu` | 0 | 0 | 0 | 30 | 7 | 0 |
| Şarj Cihazı | `sifir-urun-cep-telefonu__sarj-cihazi` | 0 | 0 | 0 | 30 | 7 | 0 |
| Şarj Kablosu | `sifir-urun-cep-telefonu__sarj-kablosu` | 0 | 0 | 0 | 30 | 7 | 0 |
| Araç Telefon Aksesuarı | `sifir-urun-cep-telefonu__arac-telefon-aksesuari` | 0 | 0 | 0 | 30 | 7 | 0 |
| Telefon Yedek Parçası | `sifir-urun-cep-telefonu__telefon-yedek-parca` | 0 | 0 | 0 | 30 | 7 | 0 |
| Cep Telefonu & Aksesuar | `sifir-urun-cep-telefonu` | 1 | 0 | 0 | 30 | 7 | 58 |
| Akıllı Saat | `sifir-urun-saat-taki__akilli-saat-moda` | 0 | 0 | 0 | 18 | 2 | 0 |
| Bileklik | `sifir-urun-saat-taki__bileklik` | 0 | 0 | 0 | 18 | 2 | 0 |
| Telefon ve Aksesuar | `sifir-urun__elektronik__telefon-ve-aksesuar` | 0 | 0 | 0 | 0 | 0 | 0 |
| Akıllı Telefon | `sifir-urun-cep-telefonu__akilli-telefon` | 4 | 3 | 7 | 30 | 7 | 58 |

## Target phone tree (from MD)
- Elektronik › Telefon ve Aksesuar › Cep Telefonu › (Akıllı/Tuşlu/Katlanabilir/Outdoor)
- … › Telefon Aksesuarları › …
- … › Giyilebilir Teknoloji › …
- … › İletişim Cihazları › …

## Preserve IDs
- Prefer KEEP/MOVE for `sifir-urun-cep-telefonu__akilli-telefon` and `…__tuslu-telefon`
- Split `Cep Telefonu & Aksesuar` / compound accessory leaves — MANUAL_REVIEW

## Auto vs manual
- Auto: alias for soft-deleted wrappers
- Manual: Product/Listing reassignment on SPLIT

## Rollback
- Checkpoint category parentId/path before batch
- Keep old slug as CategoryAlias
- Do not hard-delete categories with relations

## Related attr debt
Çamaşır Makinesi has fridge attrs: hacim,kapi-tipi,no-frost
