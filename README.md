# teklifbu.com

Şeffaf teklif pazarı (Next.js + PostgreSQL). Veriler **PostgreSQL**'de tutulur; localStorage kullanılmaz.

## Diğer projelerden ayrılık

- Bu proje klasörü: `Downloads/teklifbu`
- Kendi Docker container'ı: `teklifbu-postgres` (**port 5433**)
- Fintek veya diğer projelerin DB'sine (5432) dokunmaz

## Kurulum

```bash
docker compose up -d
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Site: http://localhost:3010
(Port 3000 diğer projeye bırakıldı)

## Demo hesaplar

| Rol | Telefon | Şifre/OTP |
|-----|---------|-----------|
| Admin | 05000000000 | admin123 |
| Satıcı | 05321112233 | OTP 1234 |
| Alıcı | 05324445566 | OTP 1234 |

OTP geliştirme kodu: **1234** (admin ayarından değiştirilebilir; SMS altyapısı hazır)

## Önemli sayfalar

- `/` Ana sayfa
- `/ilanlar` Liste
- `/ilan/[id]` Detay + teklif
- `/ilan-ver` İlan ekle
- `/giris` OTP giriş
- `/hesabim` Hesap paneli
- `/jeton` Jeton paketleri (ödeme simülasyon)
- `/admin` Sistem yönetimi

## Sunucuya taşıma

1. PostgreSQL bağlantısı: `DATABASE_URL`
2. `AUTH_SECRET` güçlü bir değer
3. `OTP_PROVIDER=sms` + SMS entegrasyonu
4. `npm run build && npm start`
