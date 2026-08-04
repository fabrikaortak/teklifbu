import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** Anasayfa / jeton kartları — giriş gerektirmez */
export async function GET() {
  try {
    const packages = await prisma.tokenPackage.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { tokenAmount: "asc" }],
    });

    return NextResponse.json({
      packages: packages.map((p) => {
        const row = p as typeof p & { discountPercent?: number };
        return {
          id: p.id,
          name: p.name,
          description: (p as typeof p & { description?: string | null }).description || null,
          tokenAmount: Number(p.tokenAmount),
          priceTl: Number(p.priceTl),
          discountPercent: Math.max(0, Number(row.discountPercent ?? 0)),
          sortOrder: Number(p.sortOrder),
        };
      }),
    });
  } catch (err) {
    console.error("[token-packages]", err);
    // Eski Prisma client / şema uyumsuzluğunda ham SQL ile dene
    try {
      const rows = await prisma.$queryRawUnsafe<
        Array<{
          id: string;
          name: string;
          tokenAmount: number | bigint;
          priceTl: number | bigint;
          discountPercent?: number | bigint | null;
          sortOrder: number | bigint;
        }>
      >(
        `SELECT id, name, "tokenAmount", "priceTl",
                COALESCE("discountPercent", 0) AS "discountPercent",
                "sortOrder"
         FROM "TokenPackage"
         WHERE "isActive" = true
         ORDER BY "sortOrder" ASC, "tokenAmount" ASC`
      );
      return NextResponse.json({
        packages: rows.map((p) => ({
          id: p.id,
          name: p.name,
          tokenAmount: Number(p.tokenAmount),
          priceTl: Number(p.priceTl),
          discountPercent: Math.max(0, Number(p.discountPercent ?? 0)),
          sortOrder: Number(p.sortOrder),
        })),
      });
    } catch (err2) {
      console.error("[token-packages fallback]", err2);
      return NextResponse.json({ packages: [], error: "Paketler alınamadı" }, { status: 500 });
    }
  }
}
