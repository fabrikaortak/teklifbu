import { unlink } from "node:fs/promises";
import path from "node:path";

/**
 * /uploads/... yollarını public/uploads altından siler.
 * Path traversal engelli; yalnızca yerel upload dosyaları.
 */
export async function deleteLocalUploadUrls(urls: unknown): Promise<string[]> {
  const list = Array.isArray(urls) ? urls : [];
  const deleted: string[] = [];
  const uploadRoot = path.resolve(process.cwd(), "public", "uploads");

  for (const raw of list) {
    const url = String(raw || "").trim();
    if (!url.startsWith("/uploads/")) continue;
    const name = path.basename(url);
    if (!name || name === "." || name === ".." || name.includes("..")) continue;
    // yalnızca basit dosya adı (timestamp-xxx.ext)
    if (!/^[a-zA-Z0-9._-]+$/.test(name)) continue;

    const filePath = path.resolve(uploadRoot, name);
    if (!filePath.startsWith(uploadRoot + path.sep) && filePath !== uploadRoot) continue;

    try {
      await unlink(filePath);
      deleted.push(`/uploads/${name}`);
    } catch {
      // yoksa veya silinemiyorsa sessiz geç
    }
  }
  return deleted;
}
