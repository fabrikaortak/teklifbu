/**
 * Pure cascade-clear contract checks for CategoryLadderValue shape.
 * Mirrors the clear rules wired in CategoryLadderPicker (no browser).
 * npx tsx scripts/test-vehicle-stage1-cascade-clear.ts
 */

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

type V = {
  brand: string;
  model: string;
  trim: string;
  generation: string;
  version: string;
  modelYear: string;
};

function onBrandChange(prev: V, brand: string): V {
  return { ...prev, brand, model: "", trim: "", generation: "", version: "", modelYear: "" };
}
function onModelChange(prev: V, model: string): V {
  return { ...prev, model, trim: "", generation: "", version: "", modelYear: "" };
}
function onGenerationChange(prev: V, generation: string): V {
  return { ...prev, generation, version: "", trim: "", modelYear: "" };
}
function onVersionChange(prev: V, version: string): V {
  return { ...prev, version, trim: version, modelYear: "" };
}
function onCategoryChange(): V {
  return { brand: "", model: "", trim: "", generation: "", version: "", modelYear: "" };
}

const filled: V = {
  brand: "bmw",
  model: "3-serisi",
  trim: "320i",
  generation: "default",
  version: "320i",
  modelYear: "2020",
};

const afterBrand = onBrandChange(filled, "audi");
assert(afterBrand.brand === "audi", "brand set");
assert(!afterBrand.model && !afterBrand.trim && !afterBrand.generation && !afterBrand.version && !afterBrand.modelYear, "F brand clears children");

const afterModel = onModelChange(filled, "5-serisi");
assert(afterModel.model === "5-serisi", "model set");
assert(!afterModel.trim && !afterModel.generation && !afterModel.version && !afterModel.modelYear, "G model clears children");

const afterGen = onGenerationChange(filled, "g20");
assert(afterGen.generation === "g20", "gen set");
assert(!afterGen.version && !afterGen.trim && !afterGen.modelYear, "H gen clears version/year");

const afterVer = onVersionChange(filled, "330i");
assert(afterVer.version === "330i" && afterVer.trim === "330i", "version syncs trim");
assert(!afterVer.modelYear, "version clears year");

const afterCat = onCategoryChange();
assert(Object.values(afterCat).every((x) => !x), "I category clears all cascade fields");

console.log(JSON.stringify({ ok: true, checks: ["F", "G", "H", "I", "version→year"] }, null, 2));
