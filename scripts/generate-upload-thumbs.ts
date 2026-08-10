/**
 * public/uploads içindeki mevcut görseller için eksik .thumb.webp üretir.
 *
 *   npx tsx scripts/generate-upload-thumbs.ts
 *   npx tsx scripts/generate-upload-thumbs.ts --dry-run
 */
import { readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { LISTING_THUMB_MAX_EDGE, listingThumbUrl } from "../src/lib/listingImage";

async function main() {
  const dry = process.argv.includes("--dry-run");
  const dir = path.join(process.cwd(), "public", "uploads");
  let files: string[] = [];
  try {
    files = await readdir(dir);
  } catch {
    console.error("uploads klasörü yok:", dir);
    process.exit(1);
  }

  const images = files.filter((f) => {
    if (f.endsWith(".thumb.webp")) return false;
    return /\.(jpe?g|png|webp|gif)$/i.test(f);
  });

  let made = 0;
  let skip = 0;
  let fail = 0;

  for (const name of images) {
    const url = `/uploads/${name}`;
    const thumbName = path.basename(listingThumbUrl(url));
    const thumbPath = path.join(dir, thumbName);
    const srcPath = path.join(dir, name);

    try {
      await stat(thumbPath);
      skip += 1;
      continue;
    } catch {
      // yok → üret
    }

    if (dry) {
      console.log("[dry] would create", thumbName, "from", name);
      made += 1;
      continue;
    }

    try {
      const buf = await sharp(srcPath)
        .rotate()
        .resize({
          width: LISTING_THUMB_MAX_EDGE,
          height: LISTING_THUMB_MAX_EDGE,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 72 })
        .toBuffer();
      await writeFile(thumbPath, buf);
      made += 1;
      console.log("ok", thumbName);
    } catch (e) {
      fail += 1;
      console.error("fail", name, e);
    }
  }

  console.log({ total: images.length, made, skip, fail, dry });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
