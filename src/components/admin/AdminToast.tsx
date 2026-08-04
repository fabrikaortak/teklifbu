"use client";

import { useEffect } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";

type Props = {
  message: string | null;
  tone?: "ok" | "err";
  onClose: () => void;
  durationMs?: number;
};

/** Sağ alt köşe toast bildirimi (admin) */
export function AdminToast({ message, tone = "ok", onClose, durationMs = 3200 }: Props) {
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(t);
  }, [message, durationMs, onClose]);

  if (!message) return null;

  const ok = tone === "ok";

  return (
    <div className={`adm-toast ${ok ? "is-ok" : "is-err"}`} role="status">
      {ok ? <CheckCircle2 size={18} color="#4ade80" /> : <XCircle size={18} color="#fca5a5" />}
      <span className="adm-toast__text">{message}</span>
      <button type="button" className="adm-toast__close" onClick={onClose} aria-label="Kapat">
        <X size={14} />
      </button>
    </div>
  );
}
