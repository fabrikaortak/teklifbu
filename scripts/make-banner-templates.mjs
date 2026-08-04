import sharp from "sharp";
import path from "path";
import os from "os";

const outDir = path.join(os.homedir(), "Downloads");

async function solid(w, h, file) {
  // Sadece siyah zemin — metin / telefon / ikon yok (tasarım şablonu)
  const dest = path.join(outDir, file);
  await sharp({
    create: {
      width: w,
      height: h,
      channels: 3,
      background: { r: 5, g: 5, b: 5 },
    },
  })
    .png()
    .toFile(dest);
  console.log("ok", dest, `${w}x${h}`);
}

await solid(840, 168, "teklifbu-ust-banner-4ilan-840x168.png");
await solid(1000, 168, "teklifbu-ust-banner-5ilan-1000x168.png");
await solid(1200, 168, "teklifbu-ust-banner-6ilan-1200x168.png");
await solid(320, 148, "teklifbu-sag-alt-banner-320x148.png");
await solid(840, 200, "teklifbu-ust-banner-4ilan-840x200.png");
await solid(320, 200, "teklifbu-sag-alt-banner-320x200.png");
