/**
 * Smoke tests for Vasıta Stage1 browse tree (no DB required for browse).
 * npx tsx scripts/test-vehicle-stage1-browse.ts
 */
import { CATEGORY_BROWSE_TREE, matchBrowsePath, validateListingCategorySelection } from "@/data/categoryBrowseTree";
import { buildVasitaBrowseNode } from "@/lib/vasitaBrowseFromTarget";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function main() {
  const vasita = buildVasitaBrowseNode();
  assert(vasita.id === "arac", "root id");
  assert((vasita.children?.length || 0) === 15, `expected 15 mains, got ${vasita.children?.length}`);

  const inTree = CATEGORY_BROWSE_TREE.find((n) => n.id === "arac");
  assert(inTree, "CATEGORY_BROWSE_TREE has arac");
  assert((inTree!.children?.length || 0) === 15, "browse tree wired");

  const names = (vasita.children || []).map((c) => c.name);
  assert(names.includes("Otomobil"), "Otomobil");
  assert(names.includes("Elektrikli Araçlar"), "Elektrikli");
  assert(names.includes("UTV"), "UTV");
  assert(names.includes("Hava Araçları"), "Hava");

  const oto = vasita.children!.find((c) => c.name === "Otomobil")!;
  assert(oto.filter.subtype === "otomobil", "otomobil subtype");
  assert(!oto.children?.length, "otomobil leaf (no sedan children)");

  const moto = vasita.children!.find((c) => c.name === "Motosiklet")!;
  assert((moto.children?.length || 0) >= 20, "moto classes");
  const scooter = moto.children!.find((c) => c.name === "Scooter")!;
  assert(scooter.filter.subtype === "motosiklet", "scooter uses motosiklet subtype for brands");

  const path = matchBrowsePath({
    category: "arac",
    dealType: "SATILIK",
    subtype: "otomobil",
    rental: "",
  });
  assert(path.length >= 2, `match path otomobil: ${path.join(">")}`);

  const err = validateListingCategorySelection({
    categorySlug: "arac",
    dealType: "SATILIK",
    attributes: { subtype: "otomobil", brand: "bmw", model: "3-serisi" },
  });
  // may fail if bmw/3-serisi not in catalog — check empty brand path
  const err2 = validateListingCategorySelection({
    categorySlug: "arac",
    dealType: "SATILIK",
    attributes: { subtype: "karavan" },
  });
  assert(err2 === null, `karavan without brands should pass: ${err2}`);

  const err3 = validateListingCategorySelection({
    categorySlug: "arac",
    dealType: "SATILIK",
    attributes: { subtype: "utv" },
  });
  assert(err3 === null, `utv without brands should pass: ${err3}`);

  console.log(
    JSON.stringify(
      {
        ok: true,
        mains: vasita.children!.length,
        motoLeaves: moto.children!.length,
        otomobilPath: path,
        brandValidateSample: err,
      },
      null,
      2
    )
  );
}

main();
