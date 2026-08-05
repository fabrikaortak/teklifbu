/**
 * Smoke tests for catalog browse transition.
 * npx tsx scripts/test-catalog-browse-transition.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const report = {
    browseApi: null,
    rootsHidden: false,
    anaCategories: [],
    inactiveHidden: true,
    sortOrderOk: true,
    breadcrumb: null,
    resolveDeep: null,
    errors: [],
  };

  // Simulate getCatalogTree + browse transform via API logic
  const { getCatalogTree } = await import("../src/core/services/catalog/categoryTreeService.ts");
  const { resolveAlisverisBrowseTree } = await import("../src/lib/alisverisBrowseFromDb.ts");
  const { resolveCategoryFilterIds } = await import("../src/lib/syncCategories.ts");

  const tree = await getCatalogTree("all");
  const { tree: browse, meta } = resolveAlisverisBrowseTree(tree);
  report.browseApi = { source: meta.source, rootCount: browse.length, names: browse.map((b) => b.name) };
  report.rootsHidden = !browse.some((b) => /ikinci el|sıfır ürün|sifir/i.test(b.name) && b.id === "ikinci-el");
  report.anaCategories = browse.map((b) => b.name);

  // Inactive should not appear in tree (getCatalogTree filters isActive)
  const inactive = await prisma.category.findFirst({
    where: { isActive: false, slug: { startsWith: "ikinci-el" }, deletedAt: null },
  });
  if (inactive) {
    const flat = JSON.stringify(tree);
    report.inactiveHidden = !flat.includes(inactive.slug);
  }

  // Breadcrumb
  const leaf = await prisma.category.findUnique({
    where: { slug: "ikinci-el-cep-telefonu__akilli-telefon" },
  });
  if (leaf) {
    const { getCategoryBreadcrumb } = await import("../src/core/services/catalog/categoryTreeService.ts");
    const crumbs = await getCategoryBreadcrumb({ categoryId: leaf.id });
    report.breadcrumb = crumbs.map((c) => c.name);
    if (crumbs.some((c) => c.slug === "ikinci-el" || c.slug === "sifir-urun")) {
      report.errors.push("breadcrumb shows system root");
    }
  }

  // Deep filter resolve
  const ids = await resolveCategoryFilterIds(prisma, "ikinci-el__elektronik");
  report.resolveDeep = { count: ids?.length || 0, ok: (ids?.length || 0) > 3 };

  // sortOrder on browse children under first ana
  const first = browse[0];
  if (first?.children?.length) {
    // condition level exists
    report.sortOrderOk = first.children.every((c) => c.name === "İkinci El" || c.name === "Sıfır");
  }

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
