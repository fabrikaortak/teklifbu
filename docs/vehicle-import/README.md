# Vasıta katalog dosya import raporu

Branch: `fix/vehicle-catalog-file-import`  
Baseline tag: `vehicle-stage1-catalog-complete` @ `fdf1524`

## Kaynak

`docs/vehicle-import/source/` altına kopyalanan 6 dosya.

## Sonuç özeti

| Metrik | Değer |
|--------|------:|
| JSON/CSV tutarlı | EVET |
| Kaynak düz kayıt | 4188 |
| CREATE_SAFE | 1952 |
| KEEP_EXISTING | 198 |
| UPDATE_NAME_SAFE | 2 |
| MOVE_SAFE | 0 |
| MANUAL_REVIEW | 6 |
| SKIP_OVERLAY | 134 |
| Empty brand branches | 33 |
| CONFLICT | 0 |
| Listing categoryId değişimi | 0 |

## Mimari kontroller

- BMW 3 Serisi → `arac/otomobil`
- BMW X3 → `arac/arazi-suv-pickup`
- Tesla Model 3 → `arac/otomobil`
- Tesla Model Y → `arac/arazi-suv-pickup`
- TOGG T10X → `arac/arazi-suv-pickup`
- TOGG T10F → `arac/otomobil`

## Scriptler

- `npm run vehicle:catalog-validate`
- `npm run vehicle:catalog-apply-dry`
- `npm run vehicle:catalog-apply`
- `npm run vehicle:catalog-test`
