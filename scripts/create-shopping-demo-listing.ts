/**
 * Tek seferlik: Alışveriş e-ticaret demo ürün ilanı oluşturur.
 * Çalıştır: npx tsx scripts/create-shopping-demo-listing.ts
 */
import { DealType, ListingStatus, Prisma } from "@prisma/client";
import { prisma } from "../src/lib/db";
import { generateListingNo } from "../src/lib/listingNo";
import { ensureDefaultTenant } from "../src/core/services/tenantService";
import { demoAttributes } from "../src/core/services/demoListingsService";

const DEMO_SELLER_PHONE = "05321112233";

const IMAGES = [
  "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=900",
  "https://images.unsplash.com/photo-1556911220-bff31c812dba?w=900",
  "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=900",
  "https://images.unsplash.com/photo-1563453392212-326f5e854473?w=900",
];

async function main() {
  const admin =
    (await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } })) ||
    (await prisma.user.findFirst({ select: { id: true } }));
  if (!admin) throw new Error("Kullanıcı bulunamadı");

  const tenant = await ensureDefaultTenant(admin.id);

  let seller = await prisma.user.findUnique({ where: { phone: DEMO_SELLER_PHONE } });
  if (!seller) {
    seller = await prisma.user.create({
      data: {
        phone: DEMO_SELLER_PHONE,
        phoneVerified: true,
        name: "KIZ EVİ Mağaza",
        email: "demo-satici@teklifbu.com",
        accountType: "TICARI",
        tokenBalance: 100,
        tenantId: tenant.id,
        isPremiumSeller: true,
        profile: {
          commercialTitle: "KIZ EVİ Mağaza",
          shopFocus: "alisveris",
        } as Prisma.InputJsonValue,
      },
    });
  }

  const preferredSlugs = [
    "sifir-urun-elektrikli-ev-aletleri",
    "sifir-urun-ev-elektronigi",
    "sifir-urun-beyaz-esya",
    "ikinci-el-beyaz-esya",
    "sifir-urun-ev-dekorasyon",
  ];

  let cat = null as { id: string; slug: string } | null;
  for (const slug of preferredSlugs) {
    const found = await prisma.category.findFirst({
      where: { slug, isActive: true },
      select: { id: true, slug: true },
    });
    if (found) {
      cat = found;
      break;
    }
  }
  if (!cat) {
    cat = await prisma.category.findFirst({
      where: { OR: [{ slug: { startsWith: "sifir-urun" } }, { slug: { startsWith: "ikinci-el" } }] },
      select: { id: true, slug: true },
    });
  }
  if (!cat) throw new Error("Alışveriş kategorisi bulunamadı");

  const listingNo = await generateListingNo();
  const now = new Date();
  const ends = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const attrs = demoAttributes({
    brand: "BRITA",
    model: "Marella XL",
    condition: "Sıfır",
    warranty: "2 Yıl",
    color: "Beyaz",
    sku: "BR-MXL-35-W",
    barcode: "4006387078508",
    listPrice: 1099,
    premiumPrice: 782.7,
    stockQty: 12,
    shippingFree: "Evet",
    sameDayShipping: "Evet",
    shippingLabel: "Yarın Kapında",
    badgeText: "EN ÇOK SATAN",
    promoBadge: "Premium'a Özel 100 TL İndirim",
    highlights:
      "Maxtra Pro All-In-1 filtre teknolojisi\n3.5 L sürahi kapasitesi\nBPA içermez, gıda teması güvenli\nKolay doldurma kapağı ve ergonomik tutacak\nBuzdolabı rafına uyumlu tasarım",
    returnDays: 14,
    originCountry: "Almanya",
    installmentNote: "Tek çekim | 882,70 TL\n3 taksit | 294,23 TL / ay\n6 taksit | 147,12 TL / ay\n9 taksit | 98,08 TL / ay",
  });

  const listing = await prisma.listing.create({
    data: {
      listingNo,
      sellerId: seller.id,
      tenantId: tenant.id,
      categoryId: cat.id,
      title: "BRITA Marella XL 3.5 L Maxtra Pro All-In-1 Filtreli Su Arıtma Sürahisi - Beyaz",
      description:
        "<p><strong>Demo e-ticaret ürün ilanı.</strong> BRITA Marella XL, evde pratik su filtrasyonu sunar. Maxtra Pro All-In-1 kartuş ile kireç, klor ve metal azaltımı; 3.5 L kapasite ile aile kullanımı için idealdir.</p><ul><li>Kolay kurulum</li><li>Filtre değişim göstergesi</li><li>Buzdolabına sığan ince gövde</li></ul><p>Bu kayıt demo amaçlıdır; gerçek stok/satış garantisi vermez.</p>",
      city: "İstanbul",
      district: "Ataşehir",
      neighborhood: "Barbaros",
      dealType: DealType.SATILIK,
      askPrice: BigInt(883),
      highestBid: BigInt(0),
      bidCount: 0,
      status: ListingStatus.ACTIVE,
      isFeatured: true,
      durationDays: 14,
      startsAt: now,
      endsAt: ends,
      coverImage: IMAGES[0],
      images: IMAGES,
      attributes: attrs as Prisma.InputJsonValue,
      contactPhone: seller.phone,
      escrowEligible: true,
    },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        id: listing.id,
        listingNo: listing.listingNo,
        slug: cat.slug,
        url: `/ilan/${listing.id}`,
        title: listing.title,
        askPrice: Number(listing.askPrice),
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
