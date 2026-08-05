import { NextResponse } from "next/server";
import { requireCatalogAdmin } from "@/lib/catalogAdminAuth";
import { prisma } from "@/lib/db";
import { normalizeCatalogText } from "@/lib/catalogCommerce";

/** Duplicate / barkod çakışma taraması */
export async function GET() {
  const { error } = await requireCatalogAdmin();
  if (error) return error;

  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      barcode: true,
      brandId: true,
      modelId: true,
      categoryId: true,
      brand: { select: { name: true } },
      model: { select: { name: true } },
    },
    take: 2000,
  });

  const byBarcode = new Map<string, typeof products>();
  const byNorm = new Map<string, typeof products>();
  for (const p of products) {
    if (p.barcode) {
      const list = byBarcode.get(p.barcode) || [];
      list.push(p);
      byBarcode.set(p.barcode, list);
    }
    const key = `${p.brandId || ""}|${p.modelId || ""}|${normalizeCatalogText(p.name)}`;
    const list = byNorm.get(key) || [];
    list.push(p);
    byNorm.set(key, list);
  }

  const barcodeConflicts = [...byBarcode.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([barcode, rows]) => ({ barcode, products: rows }));

  const nameDuplicates = [...byNorm.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([key, rows]) => ({ key, products: rows }))
    .slice(0, 100);

  return NextResponse.json({ ok: true, barcodeConflicts, nameDuplicates });
}
