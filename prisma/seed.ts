import { PrismaClient, AccountType, ListingStatus, BidStatus, UserRole, DealType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_SETTINGS } from "../src/core/defaultSettings";

const prisma = new PrismaClient();

async function main() {
  for (const [key, meta] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value: meta.value as object, label: meta.label, group: meta.group },
      update: { label: meta.label, group: meta.group },
    });
  }

  const { syncCategories } = await import("../src/lib/syncCategories");
  await syncCategories(prisma);

  const adminHash = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { phone: "05000000000" },
    create: {
      phone: "05000000000",
      phoneVerified: true,
      name: "Sistem Admin",
      email: "admin@teklifbu.com",
      passwordHash: adminHash,
      accountType: AccountType.BIREYSEL,
      role: UserRole.ADMIN,
      tokenBalance: 9999,
    },
    update: { role: UserRole.ADMIN, passwordHash: adminHash, email: "admin@teklifbu.com", phoneVerified: true },
  });

  const { ensureDefaultTenant, writeAuditLog } = await import("../src/core/services/tenantService");
  const tenant = await ensureDefaultTenant(admin.id);
  await prisma.user.update({ where: { id: admin.id }, data: { tenantId: tenant.id } });

  const sellerHash = await bcrypt.hash("123456", 10);
  const sellerCommercialProfile = {
    companyName: "Demo Alışveriş Mağazası",
    commercialTitle: "Demo Alışveriş Mağazası",
    companyType: "LIMITED",
    taxOffice: "Kadıköy",
    taxNumber: "1111111111",
    tradeRegistryNo: "100001",
    mersisNo: "0111111111111111",
    naceCode: "47.19",
    businessCity: "İstanbul",
    businessDistrict: "Kadıköy",
    businessAddress: "Demo Cad. No:1",
    authorizedTitle: "Mağaza Sahibi",
    authorizedPhone: "05321112233",
    shopFocusRoot: "alisveris",
    shopFocusSub: "elektronik",
    shopFocusOtherNote: "",
  };
  const seller = await prisma.user.upsert({
    where: { phone: "05321112233" },
    create: {
      phone: "05321112233",
      phoneVerified: true,
      name: "Ahmet Yılmaz",
      email: "satici@teklifbu.com",
      passwordHash: sellerHash,
      accountType: AccountType.TICARI,
      commercialStatus: "APPROVED",
      profile: sellerCommercialProfile,
      tokenBalance: 50,
      tenantId: tenant.id,
    },
    update: {
      tenantId: tenant.id,
      passwordHash: sellerHash,
      email: "satici@teklifbu.com",
      phoneVerified: true,
      accountType: AccountType.TICARI,
      commercialStatus: "APPROVED",
      profile: sellerCommercialProfile,
    },
  });
  const existingSellerShop = await prisma.shop.findFirst({ where: { ownerId: seller.id } });
  if (!existingSellerShop) {
    await prisma.shop.create({
      data: {
        name: "Demo Alışveriş Mağazası",
        slug: `demo-alisveris-${seller.id.slice(-6)}`,
        ownerId: seller.id,
        accountType: AccountType.TICARI,
        city: "İstanbul",
        phone: "05321112233",
        isActive: true,
        tenantId: tenant.id,
      },
    });
  }

  const buyer = await prisma.user.upsert({
    where: { phone: "05324445566" },
    create: {
      phone: "05324445566",
      phoneVerified: true,
      name: "Mehmet Demir",
      email: "alici@teklifbu.com",
      passwordHash: sellerHash,
      accountType: AccountType.BIREYSEL,
      tokenBalance: 120,
      tenantId: tenant.id,
    },
    update: {
      tokenBalance: 120,
      tenantId: tenant.id,
      passwordHash: sellerHash,
      email: "alici@teklifbu.com",
      phoneVerified: true,
    },
  });

  const tokenPkgCount = await prisma.tokenPackage.count();
  if (tokenPkgCount === 0) {
    await prisma.tokenPackage.createMany({
      data: [
        { name: "Başlangıç", tokenAmount: 10, priceTl: 99, sortOrder: 1 },
        { name: "Popüler", tokenAmount: 50, priceTl: 399, sortOrder: 2 },
        { name: "Profesyonel", tokenAmount: 120, priceTl: 799, sortOrder: 3 },
      ],
    });
  }

  const shopPkgCount = await prisma.shopPackage.count();
  if (shopPkgCount === 0) {
    await prisma.shopPackage.createMany({
      data: [
        {
          accountType: AccountType.GALERICI,
          name: "Galeri Standart",
          monthlyPrice: 2500,
          listingLimit: 10,
          description: "10 araç ilanı / ay",
        },
        {
          accountType: AccountType.EMLAKCI,
          name: "Emlak Ofisi",
          monthlyPrice: 3500,
          listingLimit: 25,
          description: "25 emlak ilanı / ay",
        },
      ],
    });
  }
  const cats = await prisma.category.findMany();
  const bySlug = Object.fromEntries(cats.map((c) => [c.slug, c]));

  const existing = await prisma.listing.count();
  if (existing === 0) {
    const now = new Date();
    const ends = new Date(now.getTime() + 2.5 * 24 * 60 * 60 * 1000);

    const demoListings = [
      {
        title: "Cadde Üzeri 3+1 Daire",
        description: "Merkezi konumda, bakımlı 3+1 daire. Asansörlü, otoparklı.",
        city: "İstanbul",
        district: "Kadıköy",
        neighborhood: "Caferağa",
        dealType: DealType.SATILIK,
        askPrice: BigInt(11000000),
        categoryId: bySlug.konut.id,
        coverImage: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800",
        images: [
          "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800",
          "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",
        ],
        attributes: { m2: 145, floor: 5, age: 8, heating: "Doğalgaz" },
        isFeatured: true,
      },
      {
        title: "2021 Model BMW 320i",
        description: "Hatasız, bakımlı, düşük km.",
        city: "Ankara",
        district: "Çankaya",
        neighborhood: "Çayyolu",
        dealType: DealType.SATILIK,
        askPrice: BigInt(2450000),
        categoryId: bySlug.arac.id,
        coverImage: "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800",
        images: ["https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800"],
        attributes: { year: 2021, km: 42000, fuel: "Benzin", gear: "Otomatik" },
        isFeatured: true,
      },
      {
        title: "Köşe Başı Dükkan",
        description: "Yüksek cirolu cadde üstü işyeri.",
        city: "İzmir",
        district: "Konak",
        neighborhood: "Alsancak",
        dealType: DealType.SATILIK,
        askPrice: BigInt(8750000),
        categoryId: bySlug.isyeri.id,
        coverImage: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800",
        images: ["https://images.unsplash.com/photo-1497366216548-37526070297c?w=800"],
        attributes: { m2: 120, frontage: "Cadde" },
        isFeatured: true,
      },
      {
        title: "İmarlı Arsa 500 m²",
        description: "Konut imarlı, yol cepheli arsa.",
        city: "Antalya",
        district: "Muratpaşa",
        neighborhood: "Şirinyalı",
        dealType: DealType.SATILIK,
        askPrice: BigInt(4200000),
        categoryId: bySlug.arsa.id,
        coverImage: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800",
        images: ["https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800"],
        attributes: { m2: 500, zoning: "Konut" },
        isFeatured: true,
      },
      {
        title: "Deniz Manzaralı 2+1 Kiralık",
        description: "Eşyalı, metroya yakın kiralık daire.",
        city: "İstanbul",
        district: "Maltepe",
        neighborhood: "Küçükyalı Merkez",
        dealType: DealType.KIRALIK,
        askPrice: BigInt(45000),
        categoryId: bySlug.kiralik.id,
        coverImage: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800",
        images: ["https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800"],
        attributes: { m2: 95, floor: 8, furnished: true },
        isFeatured: true,
      },
    ];

    for (const d of demoListings) {
      const listingNo = String(Math.floor(1e11 + Math.random() * 9e11));
      const listing = await prisma.listing.create({
        data: {
          listingNo,
          sellerId: seller.id,
          tenantId: tenant.id,
          categoryId: d.categoryId,
          title: d.title,
          description: d.description,
          city: d.city,
          district: d.district,
          neighborhood: d.neighborhood,
          dealType: d.dealType,
          askPrice: d.askPrice,
          status: ListingStatus.ACTIVE,
          isFeatured: d.isFeatured,
          startsAt: now,
          endsAt: ends,
          coverImage: d.coverImage,
          images: d.images,
          attributes: d.attributes,
          contactPhone: seller.phone,
        },
      });

      const bidAmount = d.dealType === DealType.KIRALIK ? d.askPrice - BigInt(5000) : d.askPrice - BigInt(1750000);
      const safeAmount = bidAmount > BigInt(0) ? bidAmount : d.askPrice / BigInt(2);
      await prisma.bid.create({
        data: {
          listingId: listing.id,
          bidderId: buyer.id,
          amount: safeAmount,
          durationDays: 3,
          expiresAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
          status: BidStatus.ACTIVE,
          tokensSpent: 1,
        },
      });
      await prisma.listing.update({
        where: { id: listing.id },
        data: { highestBid: safeAmount, bidCount: 1 },
      });
    }
  } else {
    // Backfill neighborhoods / dealType on existing demo rows
    await prisma.listing.updateMany({
      where: { city: "İstanbul", district: "Kadıköy", neighborhood: null },
      data: { neighborhood: "Caferağa" },
    });
    await prisma.listing.updateMany({
      where: { city: "Ankara", district: "Çankaya", neighborhood: null },
      data: { neighborhood: "Çayyolu" },
    });
    await prisma.listing.updateMany({
      where: { city: "İzmir", district: "Konak", neighborhood: null },
      data: { neighborhood: "Alsancak" },
    });
    await prisma.listing.updateMany({
      where: { city: "Antalya", district: "Muratpaşa", neighborhood: null },
      data: { neighborhood: "Şirinyalı" },
    });
    await prisma.listing.updateMany({
      where: { neighborhood: "Moda" },
      data: { neighborhood: "Caferağa" },
    });
    await prisma.listing.updateMany({
      where: { neighborhood: "Lara" },
      data: { neighborhood: "Şirinyalı" },
    });
    await prisma.listing.updateMany({
      where: { neighborhood: "Küçükyalı" },
      data: { neighborhood: "Küçükyalı Merkez" },
    });
  }

  console.log("Seed OK");
  await prisma.user.updateMany({ data: { tenantId: tenant.id } });
  await prisma.listing.updateMany({ data: { tenantId: tenant.id } });

  const emlakci = await prisma.user.upsert({
    where: { phone: "05329998877" },
    create: {
      phone: "05329998877",
      phoneVerified: true,
      name: "Ayşe Emlak",
      email: "emlakci@teklifbu.com",
      passwordHash: sellerHash,
      accountType: AccountType.EMLAKCI,
      tokenBalance: 30,
      tenantId: tenant.id,
    },
    update: {
      accountType: AccountType.EMLAKCI,
      tenantId: tenant.id,
      passwordHash: sellerHash,
      email: "emlakci@teklifbu.com",
      phoneVerified: true,
    },
  });

  const shopPkg = await prisma.shopPackage.findFirst({ where: { accountType: AccountType.EMLAKCI } });
  if (shopPkg) {
    const shop = await prisma.shop.upsert({
      where: { tenantId_ownerId: { tenantId: tenant.id, ownerId: emlakci.id } },
      create: {
        tenantId: tenant.id,
        ownerId: emlakci.id,
        accountType: AccountType.EMLAKCI,
        name: "Ayşe Emlak Ofisi",
        phone: emlakci.phone,
        city: "İstanbul",
        isActive: true,
      },
      update: { isActive: true },
    });
    await prisma.shopSubscription.upsert({
      where: { userId: emlakci.id },
      create: {
        userId: emlakci.id,
        shopId: shop.id,
        packageId: shopPkg.id,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 30 * 864e5),
        isActive: true,
      },
      update: {
        shopId: shop.id,
        packageId: shopPkg.id,
        endsAt: new Date(Date.now() + 30 * 864e5),
        isActive: true,
      },
    });
  }

  const helpPages = [
    { slug: "nasil-teklif-verilir", title: "Nasıl Teklif Verilir?", kind: "HELP" as const, body: "Jeton alın, ilanı açın ve teklif tutarını seçin." },
    { slug: "sss", title: "Sıkça Sorulan Sorular", kind: "FAQ" as const, body: "İletişim onay sonrası açılır. Teklifler admin basamağına göre verilir." },
    { slug: "ana-banner", title: "Ana Banner", kind: "BANNER" as const, body: "Gerçek satıcılar, gerçek alıcılarla buluşur." },
  ];
  for (const p of helpPages) {
    await prisma.contentPage.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: p.slug } },
      create: {
        tenantId: tenant.id,
        slug: p.slug,
        title: p.title,
        body: p.body,
        kind: p.kind,
        isPublished: true,
        authorId: admin.id,
      },
      update: { title: p.title, body: p.body, isPublished: true },
    });
  }

  await writeAuditLog({
    tenantId: tenant.id,
    actorId: admin.id,
    action: "seed.complete",
    entity: "Tenant",
    entityId: tenant.id,
    meta: { slug: tenant.slug },
  });

  console.log("Tenant:", tenant.slug, tenant.id);
  console.log("Admin: 05000000000 / admin123");
  console.log("Seller: 05321112233 / 123456");
  console.log("Buyer: 05324445566 / 123456");
  console.log("Emlakçı: 05329998877 / 123456");
  console.log("OTP (dev): 1234 (yalnızca yeni üyelik)");
  console.log("Admin user id:", admin.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
