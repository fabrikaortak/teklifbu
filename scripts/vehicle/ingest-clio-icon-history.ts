import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
const path = join(process.cwd(), "data/vehicle-deep-catalog/Renault.json");
const raw = JSON.parse(readFileSync(path, "utf8"));
const src = [
  { url: "https://www.arabahabercisi.com/renault-clio-fiyat-listesi-mart-2023/", title: "Renault Clio Mart 2023 (Renault Türkiye)", date: "2023-03-12", role: "primary" },
  { url: "https://www.arabahabercisi.com/renault-clio-fiyat-listesi-eylul-2023/", title: "Renault Clio Eylül 2023 (Renault Türkiye)", date: "2023-09-15", role: "secondary" },
];
const rows = [
  { brand:"Renault", series:"Clio", model:"1.0 TCe X-Tronic 90 bg", trim:"Icon", generation:"Clio V", generationCode:"BV", yearFrom:2023, yearTo:2023, fuelType:"GASOLINE", engineVolume:"999", powerHp:"90", transmission:"AUTOMATIC", confidence:"VERIFIED_MULTI_SOURCE", verifiedForTurkey:true, category:"Otomobil", notes:"Mart/Eylül 2023 Renault TR: Icon 1.0 TCe X-Tronic 90 bg", sources:src },
  { brand:"Renault", series:"Clio", model:"1.0 TCe X-Tronic 90 bg", trim:"Touch", generation:"Clio V", generationCode:"BV", yearFrom:2023, yearTo:2023, fuelType:"GASOLINE", engineVolume:"999", powerHp:"90", transmission:"AUTOMATIC", confidence:"VERIFIED_MULTI_SOURCE", verifiedForTurkey:true, category:"Otomobil", sources:src },
  { brand:"Renault", series:"Clio", model:"1.0 TCe 90 bg", trim:"Touch", generation:"Clio V", generationCode:"BV", yearFrom:2023, yearTo:2023, fuelType:"GASOLINE", powerHp:"90", transmission:"MANUAL", confidence:"VERIFIED_MULTI_SOURCE", verifiedForTurkey:true, category:"Otomobil", sources:src },
];
const key=(c:any)=>`${c.series}|${c.model}|${c.trim}|${c.yearFrom}|${c.confidence}`;
const map=new Map(raw.configurations.map((c:any)=>[key(c),c]));
let added=0;
for (const r of rows) { if (!map.has(key(r))) { map.set(key(r), r); added++; } }
// drop empty REVIEW stub for Clio if we now have verified historical
raw.configurations=[...map.values()].filter((c:any)=>!(c.series==="Clio" && c.confidence==="REVIEW_REQUIRED" && !c.model));
raw.generatedAt=new Date().toISOString();
writeFileSync(path, JSON.stringify(raw,null,2));
console.log(JSON.stringify({added, total: raw.configurations.length}));
