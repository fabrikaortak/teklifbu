import { NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { getSession } from "@/lib/auth";
import {
  LISTING_ORIGINAL_MAX_EDGE,
  LISTING_THUMB_MAX_EDGE,
  listingThumbUrl,
} from "@/lib/listingImage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

async function writeOriginalAndThumb(buf: Buffer, type: string, baseName: string, dir: string) {
  const sharp = (await import("sharp")).default;
  const ext =
    type === "image/png"
      ? "png"
      : type === "image/webp"
        ? "webp"
        : type === "image/gif"
          ? "gif"
          : "jpg";
  const fileName = `${baseName}.${ext}`;
  const originalPath = path.join(dir, fileName);
  const url = `/uploads/${fileName}`;
  const thumbUrl = listingThumbUrl(url);
  const thumbPath = path.join(dir, path.basename(thumbUrl));

  // GIF: orijinali dokunmadan sakla (animasyon); thumb ilk kareden.
  if (type === "image/gif") {
    await writeFile(originalPath, buf);
  } else {
    const meta = await sharp(buf).rotate().metadata();
    const edge = Math.max(meta.width || 0, meta.height || 0);
    let pipeline = sharp(buf).rotate();
    if (edge > LISTING_ORIGINAL_MAX_EDGE) {
      pipeline = pipeline.resize({
        width: LISTING_ORIGINAL_MAX_EDGE,
        height: LISTING_ORIGINAL_MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      });
    }
    if (type === "image/png") {
      await writeFile(originalPath, await pipeline.png({ compressionLevel: 8 }).toBuffer());
    } else if (type === "image/webp") {
      await writeFile(originalPath, await pipeline.webp({ quality: 85 }).toBuffer());
    } else {
      await writeFile(originalPath, await pipeline.jpeg({ quality: 85, mozjpeg: true }).toBuffer());
    }
  }

  const thumbBuf = await sharp(buf)
    .rotate()
    .resize({
      width: LISTING_THUMB_MAX_EDGE,
      height: LISTING_THUMB_MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 72 })
    .toBuffer();
  await writeFile(thumbPath, thumbBuf);

  return { url, thumbUrl };
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });

  const { checkApiRateLimit, clientIpFromRequest, rateLimitResponse } = await import(
    "@/core/services/apiRateLimit"
  );
  const limited = await checkApiRateLimit({
    bucket: "upload",
    userId: session.id,
    ip: clientIpFromRequest(req),
  });
  if (!limited.ok) {
    const r = rateLimitResponse(limited.retryAfterSec);
    return NextResponse.json(r.body, r.init);
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Dosya gerekli" }, { status: 400 });
  }

  if (!IMAGE_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Sadece JPG, PNG, WEBP veya GIF yükleyebilirsiniz" },
      { status: 400 }
    );
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Dosya en fazla 8 MB olabilir" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const baseName = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });

  try {
    const { url, thumbUrl } = await writeOriginalAndThumb(buf, file.type, baseName, dir);
    return NextResponse.json({
      ok: true,
      url,
      thumbUrl,
      kind: "image",
    });
  } catch (err) {
    // sharp başarısızsa ham dosyayı yaz (eski davranış) — thumb olmadan
    console.error("[upload] sharp failed, raw fallback", err);
    const ext =
      file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : file.type === "image/gif"
            ? "gif"
            : "jpg";
    const name = `${baseName}.${ext}`;
    await writeFile(path.join(dir, name), buf);
    return NextResponse.json({
      ok: true,
      url: `/uploads/${name}`,
      thumbUrl: null,
      kind: "image",
    });
  }
}
