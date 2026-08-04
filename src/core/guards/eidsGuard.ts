import { prisma } from "@/lib/db";
import { getEidsConfig, isEidsCategory } from "@/core/services/eidsService";

export type EidsListingGuardResult =
  | {
      allowed: true;
      applicable: boolean;
      eidsVerified: boolean;
      eidsPropertyId: string | null;
      eidsVehiclePlate: string | null;
      mode: "off" | "mock" | "live";
    }
  | { allowed: false; error: string; code: "EIDS_IDENTITY" | "EIDS_AUTHORITY" | "EIDS_LIVE_UNAVAILABLE" };

type Input = {
  userId: string;
  categorySlug: string;
  propertyId?: string | null;
  vehiclePlate?: string | null;
};

/**
 * İlan yayın öncesi EİDS guard.
 * - Kapalıysa: hiç dokunmaz (mevcut akış).
 * - mock: engellemez; isteğe bağlı otomatik doğrular.
 * - live + firma kodu yok: mock’a düşer (sistem bozulmasın).
 * - live + firma kodu var: kimlik + yetki alanları zorunlu (API köprüsü sonra).
 */
export async function guardListingEids(input: Input): Promise<EidsListingGuardResult> {
  const cfg = await getEidsConfig();

  if (!cfg.enabled) {
    return {
      allowed: true,
      applicable: false,
      eidsVerified: false,
      eidsPropertyId: null,
      eidsVehiclePlate: null,
      mode: "off",
    };
  }

  const applicable = isEidsCategory(input.categorySlug, cfg.categories);
  if (!applicable) {
    return {
      allowed: true,
      applicable: false,
      eidsVerified: false,
      eidsPropertyId: null,
      eidsVehiclePlate: null,
      mode: cfg.effectiveMode,
    };
  }

  const propertyId = input.propertyId?.trim() || null;
  const vehiclePlate = input.vehiclePlate?.trim() || null;

  // Güvenli test yolu: engelleme yok
  if (cfg.effectiveMode === "mock") {
    const auto = cfg.mockAutoVerify;
    return {
      allowed: true,
      applicable: true,
      eidsVerified: auto,
      eidsPropertyId: propertyId,
      eidsVehiclePlate: vehiclePlate,
      mode: "mock",
    };
  }

  // Live: kimlik doğrulaması şart (henüz SSO yoksa kullanıcıyı net mesajla durdur — sadece live+firma kodu)
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { eidsKullaniciKodu: true, eidsIdentityVerifiedAt: true },
  });

  if (!user?.eidsKullaniciKodu || !user.eidsIdentityVerifiedAt) {
    return {
      allowed: false,
      error: "Bu kategori için EİDS kimlik doğrulaması gerekli. e-Devlet ile doğrulama yakında bağlanacak.",
      code: "EIDS_IDENTITY",
    };
  }

  const slug = input.categorySlug.toLowerCase();
  if (slug === "arac") {
    if (!vehiclePlate) {
      return { allowed: false, error: "EİDS için araç plakası gerekli", code: "EIDS_AUTHORITY" };
    }
  } else if (!propertyId) {
    return { allowed: false, error: "EİDS için taşınmaz numarası gerekli", code: "EIDS_AUTHORITY" };
  }

  // Bakanlık API köprüsü (sonraki faz). Şimdilik kimlik+alanlar tamamsa doğrulanmış say.
  return {
    allowed: true,
    applicable: true,
    eidsVerified: true,
    eidsPropertyId: propertyId,
    eidsVehiclePlate: vehiclePlate,
    mode: "live",
  };
}
