"use client";

import { useRef, useState, type CSSProperties } from "react";
import { ImagePlus, Star, Trash2, Loader2 } from "lucide-react";

type Props = {
  images: string[];
  onChange: (images: string[]) => void;
  max?: number;
};

export function ImageUploader({ images, onChange, max = 12 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    const remaining = max - images.length;
    if (remaining <= 0) {
      setError(`En fazla ${max} fotoğraf ekleyebilirsiniz`);
      return;
    }
    const list = Array.from(files).slice(0, remaining);
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of list) {
        const body = new FormData();
        body.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Yükleme başarısız");
          break;
        }
        uploaded.push(data.url);
      }
      if (uploaded.length) onChange([...images, ...uploaded]);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function removeAt(idx: number) {
    onChange(images.filter((_, i) => i !== idx));
  }

  function makeCover(idx: number) {
    if (idx === 0) return;
    const next = [...images];
    const [img] = next.splice(idx, 1);
    next.unshift(img);
    onChange(next);
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        hidden
        onChange={(e) => onFiles(e.target.files)}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(108px, 1fr))",
          gap: 10,
        }}
      >
        {images.map((src, idx) => (
          <div
            key={`${src}-${idx}`}
            style={{
              position: "relative",
              aspectRatio: "1",
              borderRadius: 12,
              overflow: "hidden",
              border: idx === 0 ? "2px solid var(--orange)" : "1px solid var(--line)",
              background: "#f1f5f9",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            {idx === 0 && (
              <span
                style={{
                  position: "absolute",
                  left: 6,
                  top: 6,
                  background: "var(--orange)",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 800,
                  padding: "3px 6px",
                  borderRadius: 6,
                }}
              >
                Kapak
              </span>
            )}
            <div style={{ position: "absolute", right: 6, bottom: 6, display: "flex", gap: 4 }}>
              {idx !== 0 && (
                <button
                  type="button"
                  title="Kapak yap"
                  onClick={() => makeCover(idx)}
                  style={iconBtn}
                >
                  <Star size={14} />
                </button>
              )}
              <button type="button" title="Sil" onClick={() => removeAt(idx)} style={iconBtn}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}

        {images.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            style={{
              aspectRatio: "1",
              borderRadius: 12,
              border: "1.5px dashed #cbd5e1",
              background: "#f8fafc",
              display: "grid",
              placeContent: "center",
              gap: 6,
              cursor: uploading ? "wait" : "pointer",
              color: "#64748b",
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            {uploading ? <Loader2 size={22} className="spin" /> : <ImagePlus size={22} />}
            {uploading ? "Yükleniyor" : "Fotoğraf ekle"}
          </button>
        )}
      </div>

      <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.45 }}>
        En az 1, en fazla {max} görsel. İlk görsel kapak olur. JPG/PNG/WEBP/GIF, max 8 MB.
      </div>
      {error && <div style={{ color: "#dc2626", fontSize: 13 }}>{error}</div>}
    </div>
  );
}

const iconBtn: CSSProperties = {
  width: 28,
  height: 28,
  border: "none",
  borderRadius: 8,
  background: "rgba(15,23,42,0.75)",
  color: "#fff",
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
};
